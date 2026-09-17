import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const parsed = z
  .object({
    SEED_EMAIL: z.string().trim().toLowerCase().email().max(254),
    SEED_PASSWORD: z.string().min(12).max(72),
    SEED_NAME: z.string().trim().min(1).max(120).default('Recepção'),
  })
  .safeParse(process.env);
if (!parsed.success)
  throw new Error(
    `Variáveis de seed inválidas: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
  );
const db = new PrismaClient();
try {
  const { SEED_EMAIL: email, SEED_PASSWORD: password, SEED_NAME: name } = parsed.data;
  await db.receptionist.upsert({
    where: { email },
    update: {},
    create: { email, name, passwordHash: await bcrypt.hash(password, 12) },
  });
  console.log('Reception account provisioned. Existing credentials were preserved.');
} finally {
  await db.$disconnect();
}
