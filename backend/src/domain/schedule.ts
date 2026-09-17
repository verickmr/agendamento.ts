import { z } from 'zod';
import { nameSchema, emailSchema, phoneSchema } from './contact.js';

export const TIMEZONE = 'America/Sao_Paulo';
export const YEAR = 2026;
export const allSlots = Array.from({ length: 10 }, (_, index) => 480 + index * 60);
export const dateSchema = z
  .string()
  .regex(/^2026-\d{2}-\d{2}$/, 'Use uma data de 2026 no formato AAAA-MM-DD.')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Data inválida.');
export const timeSchema = z
  .string()
  .regex(/^(0[89]|1[0-7]):00$/, 'Escolha um horário inteiro entre 08:00 e 17:00.');
export const versionSchema = z.number().int().positive();
export const idSchema = z.string().uuid();
export const createSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    date: dateSchema,
    time: timeSchema,
  })
  .strict();
export const patchSchema = z
  .object({
    name: nameSchema.optional(),
    date: dateSchema.optional(),
    time: timeSchema.optional(),
    version: versionSchema,
  })
  .strict()
  .refine(
    (value) => value.name !== undefined || value.date !== undefined || value.time !== undefined,
    'Informe uma alteração.',
  );
export const cancelSchema = z.object({ version: versionSchema }).strict();
export const blockSchema = z
  .object({
    date: dateSchema,
    time: timeSchema.nullish(),
    reason: z.string().trim().max(300).optional(),
  })
  .strict();
export const listSchema = z
  .object({
    date: dateSchema.optional(),
    status: z.enum(['CONFIRMED', 'CANCELLED', 'ALL']).default('CONFIRMED'),
  })
  .strict();
export const blockListSchema = z.object({ date: dateSchema.optional() }).strict();
export const dateQuerySchema = z.object({ date: dateSchema }).strict();
export type CreateAppointment = z.infer<typeof createSchema>;
export type PatchAppointment = z.infer<typeof patchSchema>;
export type CreateBlock = z.infer<typeof blockSchema>;
export type Holiday = { date: string; localName: string };
export interface HolidayProvider {
  list(): Promise<Holiday[]>;
}
export const toDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
export const dateString = (value: Date) => value.toISOString().slice(0, 10);
export const timeToMinute = (value: string) => Number(value.slice(0, 2)) * 60;
export const minuteToTime = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
export function businessDay(date: string, holidays: Holiday[]) {
  const holiday = holidays.find((item) => item.date === date);
  const weekday = toDate(date).getUTCDay();
  if (holiday) return { isBusinessDay: false, reason: `Feriado: ${holiday.localName}` };
  if (weekday === 0 || weekday === 6)
    return { isBusinessDay: false, reason: 'A clínica não atende aos finais de semana.' };
  return { isBusinessDay: true, reason: null };
}
