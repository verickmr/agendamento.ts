import { PrismaClient } from '@prisma/client';
import { readConfig } from './config.js';
import { createApp } from './app.js';
import { NagerHolidayProvider } from './infrastructure/nager.js';

const config = readConfig();
const prisma = new PrismaClient({ datasourceUrl: config.databaseUrl });
const { app, close } = createApp({ prisma, holidays: new NagerHolidayProvider(), config });
const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválida.');
await prisma.$connect();
const server = app.listen(port, '0.0.0.0', () =>
  console.log(`Serena API listening on port ${port}`),
);
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  const force = setTimeout(() => process.exit(1), 10000).unref();
  server.close(async () => {
    try {
      await close();
      await prisma.$disconnect();
      clearTimeout(force);
      process.exit(0);
    } catch {
      process.exit(1);
    }
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
