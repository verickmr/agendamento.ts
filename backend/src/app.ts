import type { PrismaClient } from '@prisma/client';
import { AuthService } from './application/auth-service.js';
import { ScheduleService } from './application/schedule-service.js';
import type { AppConfig } from './config.js';
import type { HolidayProvider } from './domain/schedule.js';
import { createHttpApp } from './http/app.js';
import { createSessionCookie, createSessionMiddleware } from './http/session.js';
import { BcryptPasswordVerifier } from './infrastructure/bcrypt-passwords.js';
import { createPostgresSessionStore } from './infrastructure/postgres-session-store.js';
import { PrismaAuthRepository } from './infrastructure/repositories/prisma-auth-repository.js';
import { PrismaScheduleRepository } from './infrastructure/repositories/prisma-schedule-repository.js';

export function createApp({
  prisma,
  holidays,
  config,
}: {
  prisma: PrismaClient;
  holidays: HolidayProvider;
  config: AppConfig;
}) {
  const schedule = new ScheduleService(new PrismaScheduleRepository(prisma), holidays);
  const auth = new AuthService(new PrismaAuthRepository(prisma), new BcryptPasswordVerifier());
  const sessions = createPostgresSessionStore(config.databaseUrl);
  const cookie = createSessionCookie(config.production);
  const app = createHttpApp({
    services: {
      auth,
      appointments: schedule,
      blocks: schedule,
      checkDatabase: async () => {
        await prisma.$queryRaw`SELECT 1`;
      },
    },
    sessionMiddleware: createSessionMiddleware(sessions.store, config.sessionSecret, cookie),
    cookie,
    config,
  });
  return { app, close: sessions.close };
}
