import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/infrastructure/postgres-session-store.js', async () => {
  const { default: session } = await import('express-session');
  return {
    createPostgresSessionStore: () => ({ store: new session.MemoryStore(), close: async () => {} }),
  };
});

let handler: typeof import('../../api/index.js').default;
beforeAll(async () => {
  vi.stubEnv('DATABASE_URL', 'postgresql://unused:unused@127.0.0.1:1/unused');
  vi.stubEnv('SESSION_SECRET', 'vercel-entry-test-secret-of-32-characters');
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('VERCEL', '1');
  vi.stubEnv('VERCEL_URL', 'serena-preview.vercel.app');
  handler = (await import('../../api/index.js')).default;
});
afterAll(() => vi.unstubAllEnvs());

it('serves API metadata under the deployed prefix', async () => {
  const response = await request(handler).get('/api/meta');
  expect(response.status).toBe(200);
  expect(response.body.timezone).toBe('America/Sao_Paulo');
  expect(response.headers['x-powered-by']).toBeUndefined();
});
it('keeps the private API protected in the deployment entrypoint', async () => {
  const response = await request(handler).get('/api/appointments');
  expect(response.status).toBe(401);
  expect(response.body.error.code).toBe('UNAUTHENTICATED');
});
it('returns JSON for unknown API routes instead of the frontend', async () => {
  const response = await request(handler).get('/api/missing');
  expect(response.status).toBe(404);
  expect(response.body.error.code).toBe('NOT_FOUND');
});
