import express from 'express';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../backend/src/app.js';
import { readConfig } from '../backend/src/config.js';
import { NagerHolidayProvider } from '../backend/src/infrastructure/nager.js';

const config = readConfig();
const prisma = new PrismaClient({ datasourceUrl: config.databaseUrl });
const { app } = createApp({ prisma, holidays: new NagerHolidayProvider(), config });

// This entrypoint only runs behind Vercel's managed ingress. The local server
// keeps its explicit TRUST_PROXY configuration instead.
if (process.env.VERCEL === '1') app.set('trust proxy', true);

const handler = express();
handler.disable('x-powered-by');
handler.use('/api', app);

export default handler;
