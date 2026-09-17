import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createApp } from '../src/app.js';

// These requests must be handled before any database operation is attempted.
const databaseUrl = 'postgresql://unused:unused@127.0.0.1:1/unused';
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
const { app, close } = createApp({
  prisma,
  holidays: { list: async () => [] },
  config: {
    databaseUrl,
    sessionSecret: 'http-contract-test-secret-with-32-characters',
    allowedOrigins: ['http://localhost:5173'],
    production: false,
    trustProxy: false,
  },
});

afterAll(async () => {
  await close();
  await prisma.$disconnect();
});

describe('HTTP boundary contract', () => {
  it('returns metadata without a database connection or private caching', async () => {
    const response = await request(app).get('/meta');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ year: 2026, timezone: 'America/Sao_Paulo' });
    expect(response.body.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it.each(['/appointments', '/availability-blocks', '/auth/me'])(
    'requires authentication for %s',
    async (path) => {
      const response = await request(app).get(path);
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    },
  );

  it('checks authentication before the origin of a private mutation', async () => {
    const response = await request(app).patch('/appointments/invalid').send({});
    expect(response.status).toBe(401);
  });

  it.each(['/auth/login', '/auth/logout'])(
    'rejects missing or foreign Origin for %s',
    async (path) => {
      for (const headers of [{}, { Origin: 'https://untrusted.example' }]) {
        const response = await request(app).post(path).set(headers).send({});
        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
      }
    },
  );

  it('requires JSON for login and public booking', async () => {
    for (const path of ['/auth/login', '/appointments']) {
      const response = await request(app)
        .post(path)
        .set('Origin', 'http://localhost:5173')
        .type('form')
        .send({ name: 'Maria' });
      expect(response.status).toBe(415);
      expect(response.body.error.code).toBe('JSON_REQUIRED');
    }
  });

  it('returns consistent validation and parser errors', async () => {
    const invalid = await request(app).get('/available?date=2026-02-30');
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    const malformed = await request(app).post('/appointments').type('json').send('{');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('INVALID_JSON');
    const oversized = await request(app)
      .post('/appointments')
      .send({ name: 'a'.repeat(17 * 1024) });
    expect(oversized.status).toBe(413);
    expect(oversized.body.error.code).toBe('BODY_TOO_LARGE');
  });

  it('returns the documented error envelope for unknown routes', async () => {
    const response = await request(app).get('/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Recurso não encontrado.' },
    });
  });
});
