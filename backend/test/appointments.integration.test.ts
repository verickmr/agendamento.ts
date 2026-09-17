import 'dotenv/config';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { HolidayProvider } from '../src/domain/schedule.js';

// Never fall back to DATABASE_URL: these tests remove test fixture records.
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl)
  throw new Error('TEST_DATABASE_URL must explicitly identify a disposable PostgreSQL database.');
if (
  process.env.DATABASE_URL &&
  new URL(testUrl).pathname === new URL(process.env.DATABASE_URL).pathname &&
  new URL(testUrl).hostname === new URL(process.env.DATABASE_URL).hostname &&
  new URL(testUrl).port === new URL(process.env.DATABASE_URL).port
) {
  throw new Error('Refusing integration tests against the application database.');
}
const prisma = new PrismaClient({ datasourceUrl: testUrl });
let failProvider = false;
let providerCalls = 0;
const holidays: HolidayProvider = {
  async list() {
    providerCalls++;
    if (failProvider) throw new Error('offline');
    return [{ date: '2026-01-01', localName: 'Ano Novo' }];
  },
};
const { app, close } = createApp({
  prisma,
  holidays,
  config: {
    databaseUrl: testUrl,
    sessionSecret: 'test-session-secret-with-at-least-32-characters',
    allowedOrigins: ['http://localhost:5173'],
    production: false,
    trustProxy: false,
  },
});
const origin = 'http://localhost:5173';
const booking = { name: ' Maria ', date: '2026-09-15', time: '08:00' };
async function login() {
  const agent = request.agent(app);
  const response = await agent
    .post('/auth/login')
    .set('Origin', origin)
    .send({ email: 'recepcao@example.com', password: 'Teste123!' });
  expect(response.status).toBe(200);
  return agent;
}
beforeAll(async () => {
  await prisma.receptionist.upsert({
    where: { email: 'recepcao@example.com' },
    update: {},
    create: {
      name: 'Recepção',
      email: 'recepcao@example.com',
      passwordHash: await bcrypt.hash('Teste123!', 12),
    },
  });
});
beforeEach(async () => {
  failProvider = false;
  providerCalls = 0;
  await prisma.availabilityBlock.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.$executeRawUnsafe('DELETE FROM session');
});
afterAll(async () => {
  await close();
  await prisma.$disconnect();
});

describe('PostgreSQL-backed scheduling and reception', () => {
  it('exposes date metadata and strict API validation', async () => {
    expect((await request(app).get('/meta')).body).toMatchObject({
      timezone: 'America/Sao_Paulo',
      year: 2026,
    });
    for (const date of ['2026-02-30', '2027-01-01'])
      expect((await request(app).get('/available').query({ date })).status).toBe(400);
    expect(
      (
        await request(app)
          .post('/appointments')
          .send({ ...booking, time: '08:30' })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/appointments')
          .send({ ...booking, name: ' ' })
      ).status,
    ).toBe(400);
  });
  it('creates a public appointment and exposes occupied times without private data', async () => {
    const created = await request(app).post('/appointments').send(booking);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      name: 'Maria',
      date: booking.date,
      time: '08:00',
      endTime: '09:00',
      status: 'CONFIRMED',
      version: 1,
      timezone: 'America/Sao_Paulo',
      cancelledAt: null,
    });
    const available = await request(app).get('/available').query({ date: booking.date });
    expect(available.body.slots).toHaveLength(9);
    expect(available.body.occupied).toEqual(['08:00']);
    expect(JSON.stringify(available.body)).not.toContain('Maria');
    expect(providerCalls).toBe(2);
  });
  it('admits exactly one of simultaneous requests for the same slot', async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () => request(app).post('/appointments').send(booking)),
    );
    expect(results.filter((result) => result.status === 201)).toHaveLength(1);
    expect(results.filter((result) => result.status === 409)).toHaveLength(5);
    expect(await prisma.appointment.count()).toBe(1);
  });
  it('rejects closed days with 422 and shows no availability', async () => {
    for (const date of ['2026-01-01', '2026-01-03', '2026-01-04']) {
      const result = await request(app).get('/available').query({ date });
      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({ isBusinessDay: false, slots: [] });
      expect(
        (
          await request(app)
            .post('/appointments')
            .send({ ...booking, date })
        ).status,
      ).toBe(422);
    }
  });
  it('fails closed when holidays are unavailable', async () => {
    failProvider = true;
    expect((await request(app).get('/available').query({ date: booking.date })).status).toBe(503);
    expect((await request(app).post('/appointments').send(booking)).status).toBe(503);
    expect(await prisma.appointment.count()).toBe(0);
  });
  it('requires a session for private data and origin for authenticated mutations', async () => {
    expect((await request(app).get('/appointments').query({ date: booking.date })).status).toBe(
      401,
    );
    expect(
      (await request(app).get('/availability-blocks').query({ date: booking.date })).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post('/auth/login')
          .send({ email: 'recepcao@example.com', password: 'Teste123!' })
      ).status,
    ).toBe(403);
    const agent = await login();
    expect((await agent.get('/auth/me')).body.user.email).toBe('recepcao@example.com');
    expect(
      (
        await agent
          .post('/availability-blocks')
          .set('Origin', 'https://attacker.example')
          .send({ date: booking.date })
      ).status,
    ).toBe(403);
    expect((await agent.post('/auth/logout').set('Origin', origin)).status).toBe(204);
    expect((await agent.get('/auth/me')).status).toBe(401);
  });
  it('persists login throttling for unknown normalized accounts', async () => {
    for (let index = 0; index < 5; index++) {
      expect(
        (
          await request(app)
            .post('/auth/login')
            .set('Origin', origin)
            .send({ email: ' Unknown@Example.com ', password: 'wrong' })
        ).status,
      ).toBe(401);
    }
    expect(
      (
        await request(app)
          .post('/auth/login')
          .set('Origin', origin)
          .send({ email: 'unknown@example.com', password: 'wrong' })
      ).status,
    ).toBe(429);
    expect(await prisma.loginAttempt.count()).toBe(5);
  });
  it('preserves old appointment on occupied or holiday reschedule, and detects stale edits', async () => {
    const agent = await login();
    const first = (await request(app).post('/appointments').send(booking)).body;
    await request(app)
      .post('/appointments')
      .send({ ...booking, time: '09:00' });
    expect(
      (
        await agent
          .patch(`/appointments/${first.id}`)
          .set('Origin', origin)
          .send({ time: '09:00', version: 1 })
      ).status,
    ).toBe(409);
    expect(
      (
        await agent
          .patch(`/appointments/${first.id}`)
          .set('Origin', origin)
          .send({ date: '2026-01-01', version: 1 })
      ).status,
    ).toBe(422);
    const updated = await agent
      .patch(`/appointments/${first.id}`)
      .set('Origin', origin)
      .send({ date: '2026-09-16', time: '10:00', name: 'Ana', version: 1 });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      date: '2026-09-16',
      time: '10:00',
      name: 'Ana',
      version: 2,
    });
    expect(
      (
        await agent
          .patch(`/appointments/${first.id}`)
          .set('Origin', origin)
          .send({ name: 'Old', version: 1 })
      ).status,
    ).toBe(409);
    expect(
      (await request(app).get('/available').query({ date: booking.date })).body.occupied,
    ).toEqual(['09:00']);
  });
  it('allows name edits and cancellation during provider outage and keeps cancellation history', async () => {
    const agent = await login();
    const created = (await request(app).post('/appointments').send(booking)).body;
    failProvider = true;
    expect(
      (
        await agent
          .patch(`/appointments/${created.id}`)
          .set('Origin', origin)
          .send({ name: 'Ana', version: 1 })
      ).status,
    ).toBe(200);
    const cancelled = await agent
      .post(`/appointments/${created.id}/cancel`)
      .set('Origin', origin)
      .send({ version: 2 });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', version: 3, name: 'Ana' });
    expect(cancelled.body.cancelledAt).toBeTruthy();
    expect(
      (
        await agent
          .patch(`/appointments/${created.id}`)
          .set('Origin', origin)
          .send({ name: 'Maria', version: 3 })
      ).status,
    ).toBe(409);
    const listed = await agent
      .get('/appointments')
      .query({ date: booking.date, status: 'CANCELLED' });
    expect(listed.body.appointments).toHaveLength(1);
    failProvider = false;
    expect((await request(app).post('/appointments').send(booking)).status).toBe(201);
  });
  it('returns conflict appointment DTOs for block creation without cancelling them', async () => {
    const agent = await login();
    const created = (await request(app).post('/appointments').send(booking)).body;
    const result = await agent
      .post('/availability-blocks')
      .set('Origin', origin)
      .send({ date: booking.date });
    expect(result.status).toBe(409);
    expect(result.body.error.details.appointments[0].id).toBe(created.id);
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: created.id } })).status).toBe(
      'CONFIRMED',
    );
  });
  it('blocks individual slots and whole days, rejects overlaps, and soft removes blocks', async () => {
    const agent = await login();
    const single = await agent
      .post('/availability-blocks')
      .set('Origin', origin)
      .send({ date: booking.date, time: '08:00', reason: 'Reunião privada' });
    expect(single.status).toBe(201);
    expect((await request(app).post('/appointments').send(booking)).status).toBe(409);
    const available = (await request(app).get('/available').query({ date: booking.date })).body;
    expect(available.blocked).toEqual(['08:00']);
    expect(JSON.stringify(available)).not.toContain('Reunião');
    expect(
      (await agent.post('/availability-blocks').set('Origin', origin).send({ date: booking.date }))
        .status,
    ).toBe(409);
    expect(
      (await agent.delete(`/availability-blocks/${single.body.id}`).set('Origin', origin)).status,
    ).toBe(204);
    expect(
      (await prisma.availabilityBlock.findUniqueOrThrow({ where: { id: single.body.id } }))
        .removedAt,
    ).toBeTruthy();
    failProvider = true;
    expect(
      (await agent.post('/availability-blocks').set('Origin', origin).send({ date: booking.date }))
        .status,
    ).toBe(201);
    failProvider = false;
    const closed = (await request(app).get('/available').query({ date: booking.date })).body;
    expect(closed).toMatchObject({ isBusinessDay: true, slots: [] });
    expect(closed.reason).toBeTruthy();
  });
  it('serializes appointment and block creation against each other', async () => {
    const agent = await login();
    const results = await Promise.all([
      request(app).post('/appointments').send(booking),
      agent
        .post('/availability-blocks')
        .set('Origin', origin)
        .send({ date: booking.date, time: '08:00' }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
  });
  it('serializes concurrent edits through optimistic versioning', async () => {
    const agent = await login();
    const created = (await request(app).post('/appointments').send(booking)).body;
    const results = await Promise.all(
      ['09:00', '10:00'].map((time) =>
        agent.patch(`/appointments/${created.id}`).set('Origin', origin).send({ time, version: 1 }),
      ),
    );
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
  });
  it('enforces slot and active appointment uniqueness at database level', async () => {
    const date = new Date('2026-09-15T00:00:00Z');
    await expect(
      prisma.appointment.create({ data: { name: 'Invalid', date, startMinute: 481 } }),
    ).rejects.toThrow();
    await prisma.appointment.create({ data: { name: 'First', date, startMinute: 480 } });
    await expect(
      prisma.appointment.create({ data: { name: 'Duplicate', date, startMinute: 480 } }),
    ).rejects.toThrow();
  });
  it('reschedules in opposite date directions without deadlock', async () => {
    const agent = await login();
    const first = (await request(app).post('/appointments').send(booking)).body;
    const second = (
      await request(app)
        .post('/appointments')
        .send({ ...booking, date: '2026-09-16' })
    ).body;
    const results = await Promise.all([
      agent
        .patch(`/appointments/${first.id}`)
        .set('Origin', origin)
        .send({ date: '2026-09-16', time: '09:00', version: 1 }),
      agent
        .patch(`/appointments/${second.id}`)
        .set('Origin', origin)
        .send({ date: '2026-09-15', time: '09:00', version: 1 }),
    ]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
  });
  it('preserves the original appointment when reschedule holiday lookup fails', async () => {
    const agent = await login();
    const created = (await request(app).post('/appointments').send(booking)).body;
    failProvider = true;
    expect(
      (
        await agent
          .patch(`/appointments/${created.id}`)
          .set('Origin', origin)
          .send({ date: '2026-09-16', version: 1 })
      ).status,
    ).toBe(503);
    const listed = await agent.get('/appointments').query({ date: booking.date });
    expect(listed.body.appointments[0]).toMatchObject({
      date: booking.date,
      time: '08:00',
      version: 1,
    });
  });
  it('reports fully booked days without changing their business-day classification', async () => {
    for (const hour of ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17']) {
      expect(
        (
          await request(app)
            .post('/appointments')
            .send({ ...booking, time: `${hour}:00` })
        ).status,
      ).toBe(201);
    }
    const result = (await request(app).get('/available').query({ date: booking.date })).body;
    expect(result).toMatchObject({ isBusinessDay: true, slots: [] });
    expect(result.occupied).toHaveLength(10);
    expect(result.reason).toBeTruthy();
  });
  it('returns 404 for absent records and 400 for malformed identifiers', async () => {
    const agent = await login();
    const absent = '00000000-0000-4000-8000-000000000000';
    expect(
      (
        await agent
          .patch(`/appointments/${absent}`)
          .set('Origin', origin)
          .send({ name: 'Maria', version: 1 })
      ).status,
    ).toBe(404);
    expect(
      (
        await agent
          .post(`/appointments/${absent}/cancel`)
          .set('Origin', origin)
          .send({ version: 1 })
      ).status,
    ).toBe(404);
    expect(
      (await agent.delete(`/availability-blocks/${absent}`).set('Origin', origin)).status,
    ).toBe(404);
    expect(
      (
        await agent
          .patch('/appointments/invalid')
          .set('Origin', origin)
          .send({ name: 'Maria', version: 1 })
      ).status,
    ).toBe(400);
  });
  it('lists appointments and active blocks without a date filter', async () => {
    const agent = await login();
    await request(app)
      .post('/appointments')
      .send({ ...booking, date: '2026-09-16' });
    await request(app).post('/appointments').send(booking);
    await agent.post('/availability-blocks').set('Origin', origin).send({ date: '2026-09-17' });
    const appointments = await agent.get('/appointments');
    expect(appointments.status).toBe(200);
    expect(appointments.body.appointments.map((item: { date: string }) => item.date)).toEqual([
      '2026-09-15',
      '2026-09-16',
    ]);
    const blocks = await agent.get('/availability-blocks');
    expect(blocks.status).toBe(200);
    expect(blocks.body.blocks).toHaveLength(1);
  });
  it('regenerates and persists sessions across application instances', async () => {
    const first = await request(app)
      .post('/auth/login')
      .set('Origin', origin)
      .send({ email: 'recepcao@example.com', password: 'Teste123!' });
    const firstCookie = first.headers['set-cookie'][0];
    expect(firstCookie).toContain('HttpOnly');
    expect(firstCookie).toContain('SameSite=Lax');
    const second = await request(app)
      .post('/auth/login')
      .set('Origin', origin)
      .set('Cookie', firstCookie.split(';')[0])
      .send({ email: 'recepcao@example.com', password: 'Teste123!' });
    const secondCookie = second.headers['set-cookie'][0].split(';')[0];
    expect(secondCookie).not.toBe(firstCookie.split(';')[0]);
    expect(
      (await request(app).get('/auth/me').set('Cookie', firstCookie.split(';')[0])).status,
    ).toBe(401);
    const replica = createApp({
      prisma,
      holidays,
      config: {
        databaseUrl: testUrl!,
        sessionSecret: 'test-session-secret-with-at-least-32-characters',
        allowedOrigins: [origin],
        production: false,
        trustProxy: false,
      },
    });
    try {
      expect((await request(replica.app).get('/auth/me').set('Cookie', secondCookie)).status).toBe(
        200,
      );
    } finally {
      await replica.close();
    }
  });
});
