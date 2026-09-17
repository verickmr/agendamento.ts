import 'dotenv/config';
import { z } from 'zod';

export interface AppConfig {
  databaseUrl: string;
  sessionSecret: string;
  allowedOrigins: string[];
  production: boolean;
  trustProxy: false | string[];
}
export function readConfig(): AppConfig {
  const schema = z.object({
    DATABASE_URL: z.string().url(),
    SESSION_SECRET: z.string().min(32),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    FRONTEND_ORIGIN: z.string().url().optional(),
    ALLOWED_ORIGINS: z.string().optional(),
    TRUST_PROXY: z.string().optional(),
  });
  const result = schema.safeParse(process.env);
  if (!result.success)
    throw new Error(
      `Configuração inválida: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
    );
  const env = result.data;
  const production = env.NODE_ENV === 'production';
  const allowedOrigins = [
    ...new Set(
      [
        env.FRONTEND_ORIGIN,
        ...(process.env.VERCEL === '1'
          ? [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
              .filter((host): host is string => Boolean(host))
              .map((host) => `https://${host}`)
          : []),
        ...(env.ALLOWED_ORIGINS?.split(',') ?? []),
        ...(production ? [] : ['http://localhost:5173']),
      ]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  if (production && allowedOrigins.length === 0)
    throw new Error('Configure FRONTEND_ORIGIN ou as URLs de implantação da Vercel.');
  for (const value of allowedOrigins) {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value)
      throw new Error('Origens permitidas devem ser URLs HTTP(S) exatas sem caminho.');
  }
  // Express must trust only the addresses of the actual ingress proxy, never all
  // clients or a hop count that can be bypassed through an alternate network path.
  const proxies = env.TRUST_PROXY?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (proxies?.some((value) => ['true', 'false', '1', '*'].includes(value)))
    throw new Error(
      'TRUST_PROXY deve listar endereços ou redes confiáveis, nunca true ou número de saltos.',
    );
  return {
    databaseUrl: env.DATABASE_URL,
    sessionSecret: env.SESSION_SECRET,
    allowedOrigins,
    production,
    trustProxy: proxies?.length ? proxies : false,
  };
}
