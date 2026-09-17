import session from 'express-session';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createHttpApp } from '../src/http/app.js';
import { createSessionCookie, createSessionMiddleware } from '../src/http/session.js';
import type { HttpServices } from '../src/http/services.js';
import { AppError } from '../src/domain/errors.js';

const origin = 'http://localhost:5173';
const user = {
  id: 'c3a46e4e-d0c6-4c64-af5b-71fbfb037200',
  name: 'Recepção',
  email: 'recepcao@example.com',
};
const appointment = {
  id: '01c1dc67-324f-4149-92c6-cfbe418869b3',
  name: 'Maria',
  date: '2026-09-16',
  time: '08:00',
  endTime: '09:00',
  timezone: 'America/Sao_Paulo',
  status: 'CONFIRMED' as const,
  version: 1,
  createdAt: '2026-09-16T10:00:00.000Z',
  updatedAt: '2026-09-16T10:00:00.000Z',
  cancelledAt: null,
};

function setup({ production = false, trustProxy = false as false | string[] } = {}) {
  const services = {
    auth: {
      login: vi.fn<HttpServices['auth']['login']>().mockResolvedValue(user),
      current: vi.fn<HttpServices['auth']['current']>().mockImplementation(async (id) => {
        if (id !== user.id)
          throw new AppError(401, 'UNAUTHENTICATED', 'Entre para acessar a recepção.');
        return user;
      }),
    },
    appointments: {
      available: vi.fn<HttpServices['appointments']['available']>(),
      create: vi.fn<HttpServices['appointments']['create']>().mockResolvedValue(appointment),
      list: vi
        .fn<HttpServices['appointments']['list']>()
        .mockResolvedValue({ appointments: [appointment] }),
      update: vi.fn<HttpServices['appointments']['update']>().mockResolvedValue(appointment),
      cancel: vi
        .fn<HttpServices['appointments']['cancel']>()
        .mockResolvedValue({ ...appointment, status: 'CANCELLED', version: 2 }),
    },
    blocks: {
      listBlocks: vi.fn<HttpServices['blocks']['listBlocks']>().mockResolvedValue({ blocks: [] }),
      createBlock: vi.fn<HttpServices['blocks']['createBlock']>(),
      removeBlock: vi.fn<HttpServices['blocks']['removeBlock']>().mockResolvedValue(undefined),
    },
    checkDatabase: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  } satisfies HttpServices;
  const cookie = createSessionCookie(production);
  const app = createHttpApp({
    services,
    sessionMiddleware: createSessionMiddleware(
      new session.MemoryStore(),
      'test-secret-with-at-least-32-characters',
      cookie,
    ),
    cookie,
    config: { allowedOrigins: [origin], trustProxy },
  });
  return { app, services };
}

function signIn(app: ReturnType<typeof createHttpApp>, cookie?: string) {
  const login = request(app).post('/auth/login').set('Origin', origin);
  if (cookie) login.set('Cookie', cookie);
  return login.send({ email: ' Recepcao@Example.com ', password: 'test-password' });
}

describe('HTTP controllers with injected services', () => {
  it('regenerates the session on login and invalidates it on bodyless logout', async () => {
    const { app, services } = setup();
    const first = await signIn(app);
    expect(first.status).toBe(200);
    expect(services.auth.login).toHaveBeenCalledWith('recepcao@example.com', 'test-password');
    const firstCookie = first.headers['set-cookie'][0];
    expect(firstCookie).toContain('HttpOnly');
    expect(firstCookie).toContain('SameSite=Lax');
    const second = await signIn(app, firstCookie.split(';')[0]);
    const secondCookie = second.headers['set-cookie'][0].split(';')[0];
    expect(secondCookie).not.toBe(firstCookie.split(';')[0]);
    expect((await request(app).get('/auth/me').set('Cookie', firstCookie)).status).toBe(401);
    expect((await request(app).get('/auth/me').set('Cookie', secondCookie)).body).toEqual({ user });
    const logout = await request(app)
      .post('/auth/logout')
      .set('Cookie', secondCookie)
      .set('Origin', origin);
    expect(logout.status).toBe(204);
    expect(logout.headers['set-cookie'][0]).toContain('serena.sid=;');
    expect((await request(app).get('/auth/me').set('Cookie', secondCookie)).status).toBe(401);
  });

  it('creates a public appointment with normalized input and no session', async () => {
    const { app, services } = setup();
    const input = { name: ' Maria ', date: appointment.date, time: appointment.time };
    const response = await request(app).post('/appointments').send(input);
    expect(response.status).toBe(201);
    expect(response.body).toEqual(appointment);
    expect(services.appointments.create).toHaveBeenCalledWith({ ...input, name: 'Maria' });
  });

  it('passes versions and the authenticated actor to administrative operations', async () => {
    const { app, services } = setup();
    const cookie = (await signIn(app)).headers['set-cookie'][0].split(';')[0];
    const edit = await request(app)
      .patch(`/appointments/${appointment.id}`)
      .set('Cookie', cookie)
      .set('Origin', origin)
      .send({ name: ' Ana ', version: 1 });
    expect(edit.status).toBe(200);
    expect(services.appointments.update).toHaveBeenCalledWith(appointment.id, {
      name: 'Ana',
      version: 1,
    });
    const cancel = await request(app)
      .post(`/appointments/${appointment.id}/cancel`)
      .set('Cookie', cookie)
      .set('Origin', origin)
      .send({ version: 1 });
    expect(cancel.status).toBe(200);
    expect(services.appointments.cancel).toHaveBeenCalledWith(appointment.id, 1, user.id);
    const removal = await request(app)
      .delete(`/availability-blocks/${appointment.id}`)
      .set('Cookie', cookie)
      .set('Origin', origin);
    expect(removal.status).toBe(204);
    expect(services.blocks.removeBlock).toHaveBeenCalledWith(appointment.id, user.id);
  });

  it('requires origin and JSON even after authentication', async () => {
    const { app, services } = setup();
    const cookie = (await signIn(app)).headers['set-cookie'][0].split(';')[0];
    const missingOrigin = await request(app)
      .patch(`/appointments/${appointment.id}`)
      .set('Cookie', cookie)
      .send({ version: 1, name: 'Ana' });
    expect(missingOrigin.status).toBe(403);
    const wrongType = await request(app)
      .patch(`/appointments/${appointment.id}`)
      .set('Cookie', cookie)
      .set('Origin', origin)
      .type('form')
      .send({ version: 1 });
    expect(wrongType.status).toBe(415);
    expect(services.appointments.update).not.toHaveBeenCalled();
  });

  it('preserves conflict details and the login retry header', async () => {
    const { app, services } = setup();
    const cookie = (await signIn(app)).headers['set-cookie'][0].split(';')[0];
    services.blocks.createBlock.mockRejectedValue(
      new AppError(409, 'BLOCK_APPOINTMENT_CONFLICT', 'Conflito.', { appointments: [appointment] }),
    );
    const conflict = await request(app)
      .post('/availability-blocks')
      .set('Cookie', cookie)
      .set('Origin', origin)
      .send({ date: appointment.date });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.details.appointments).toEqual([appointment]);
    services.auth.login.mockRejectedValue(new AppError(429, 'LOGIN_THROTTLED', 'Aguarde.'));
    const throttled = await signIn(app);
    expect(throttled.status).toBe(429);
    expect(throttled.headers['retry-after']).toBe('900');
  });

  it('issues a secure cookie behind a trusted HTTPS proxy', async () => {
    const { app } = setup({ production: true, trustProxy: ['loopback'] });
    const login = await request(app)
      .post('/auth/login')
      .set('Origin', origin)
      .set('X-Forwarded-Proto', 'https')
      .send({ email: user.email, password: 'test-password' });
    expect(login.status).toBe(200);
    expect(login.headers['set-cookie'][0]).toContain('Secure');
  });

  it('does not trust a forwarded HTTPS header without a trusted proxy', async () => {
    const { app } = setup({ production: true });
    const login = await request(app)
      .post('/auth/login')
      .set('Origin', origin)
      .set('X-Forwarded-Proto', 'https')
      .send({ email: user.email, password: 'test-password' });
    expect(login.status).toBe(200);
    expect(login.headers['set-cookie']).toBeUndefined();
  });

  it('hides unexpected service error details', async () => {
    const { app, services } = setup();
    services.appointments.create.mockRejectedValue(new Error('private database connection string'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await request(app)
        .post('/appointments')
        .send({ name: 'Maria', date: appointment.date, time: appointment.time });
      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
      expect(JSON.stringify(response.body)).not.toContain('private database');
      expect(log).toHaveBeenCalledWith('Request failed', { name: 'Error' });
    } finally {
      log.mockRestore();
    }
  });
});
