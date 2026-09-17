import { z } from 'zod';

export const nameSchema = z
  .string({
    required_error: 'Informe o nome completo.',
    invalid_type_error: 'Informe um nome válido.',
  })
  .trim()
  .min(1, 'Informe o nome completo.')
  .max(120, 'O nome deve ter até 120 caracteres.')
  .regex(/^[\p{L}\p{M} .’'\-]+$/u, 'Use apenas letras, espaços, apóstrofos ou hífens no nome.')
  .refine(
    (value) => (value.match(/\p{L}/gu) || []).length >= 2,
    'O nome deve ter pelo menos duas letras.',
  )
  .transform((value) => value.normalize('NFC').replace(/ +/g, ' '));

export const emailSchema = z
  .string({
    required_error: 'Informe um e-mail válido.',
    invalid_type_error: 'Informe um e-mail válido.',
  })
  .trim()
  .min(1, 'Informe um e-mail válido.')
  .max(254, 'O e-mail deve ter até 254 caracteres.')
  .email('Informe um e-mail válido, como nome@exemplo.com.')
  .toLowerCase();

// Códigos de área brasileiros; o DDI 55 é opcional.
const areaCode = /^(?:1[1-9]|2[12478]|3[1-578]|4[1-9]|5[1345]|6[1-9]|7[134579]|8[1-9]|9[1-9])$/;
export const phoneSchema = z
  .string({
    required_error: 'Informe um telefone com DDD.',
    invalid_type_error: 'Informe um telefone com DDD.',
  })
  .trim()
  .min(1, 'Informe um telefone com DDD.')
  .max(30, 'O telefone informado é muito longo.')
  .regex(/^\+?[\d ().-]+$/, 'Use apenas números e a formatação de telefone.')
  .refine(
    (value) => !value.startsWith('+') || /^55\d{10,11}$/.test(value.replace(/\D/g, '')),
    'Use o código do Brasil (+55), seguido do DDD e telefone.',
  )
  .transform((value) => value.replace(/\D/g, ''))
  .superRefine((digits, ctx) => {
    const national = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
    if (!/^\d{10,11}$/.test(national)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe o DDD e 8 dígitos para fixo ou 9 para celular.',
      });
      return;
    }
    if (!areaCode.test(national.slice(0, 2))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe um DDD brasileiro válido.' });
    }
    if (!/^(?:[2-5]\d{7}|9\d{8})$/.test(national.slice(2))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Celular deve começar com 9; telefone fixo, com 2, 3, 4 ou 5.',
      });
    }
  });
