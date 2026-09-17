import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readConfig } from '../src/config.js';

beforeEach(() => {
  vi.stubEnv('DATABASE_URL', 'postgresql://unused:unused@localhost:5432/test');
  vi.stubEnv('SESSION_SECRET', 'configuration-test-secret-of-32-characters');
  vi.stubEnv('NODE_ENV', 'production');
  for (const key of [
    'FRONTEND_ORIGIN',
    'ALLOWED_ORIGINS',
    'TRUST_PROXY',
    'VERCEL',
    'VERCEL_URL',
    'VERCEL_PROJECT_PRODUCTION_URL',
  ])
    vi.stubEnv(key, undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe('deployment origins', () => {
  it('requires an explicit origin in production outside Vercel', () => {
    expect(() => readConfig()).toThrow('Configure FRONTEND_ORIGIN');
  });
  it('allows only the deployment URLs provided by the Vercel environment', () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('VERCEL_URL', 'serena-preview.vercel.app');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'serena.vercel.app');
    expect(readConfig().allowedOrigins).toEqual([
      'https://serena-preview.vercel.app',
      'https://serena.vercel.app',
    ]);
  });
  it('ignores Vercel host variables when running outside Vercel', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('VERCEL_URL', 'untrusted.example');
    expect(readConfig().allowedOrigins).toEqual(['http://localhost:5173']);
    expect(readConfig().trustProxy).toBe(false);
  });
  it('keeps configured custom domains and rejects origins containing paths', () => {
    vi.stubEnv('FRONTEND_ORIGIN', 'https://clinic.example');
    expect(readConfig().allowedOrigins).toEqual(['https://clinic.example']);
    vi.stubEnv('ALLOWED_ORIGINS', 'https://clinic.example/path');
    expect(() => readConfig()).toThrow('Origens permitidas');
  });
});
