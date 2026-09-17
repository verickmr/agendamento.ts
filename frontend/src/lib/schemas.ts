import { z } from 'zod';
import { nameSchema, emailSchema, phoneSchema } from './contact-schemas';
export { nameSchema } from './contact-schemas';
export const dateSchema = z
  .string()
  .regex(/^2026-\d{2}-\d{2}$/, 'Escolha uma data de 2026.')
  .refine((v) => {
    const d = new Date(v + 'T12:00:00Z');
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Escolha uma data válida.');
export const bookingSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
});
export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, 'Informe sua senha.')
    .max(256, 'A senha deve ter até 256 caracteres.'),
});
export const editSchema = z.object({
  name: nameSchema,
  date: dateSchema,
  time: z.string().regex(/^(0[89]|1[0-7]):00$/, 'Escolha um horário.'),
});
export const blockSchema = z.object({
  date: dateSchema,
  time: z.string().regex(/^(|(0[89]|1[0-7]):00)$/, 'Escolha um período válido.'),
  reason: z.string().trim().max(300, 'Use até 300 caracteres.'),
});
