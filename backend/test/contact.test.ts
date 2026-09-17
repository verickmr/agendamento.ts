import { describe, expect, it } from 'vitest';
import { nameSchema, emailSchema, phoneSchema } from '../src/domain/contact.js';

describe('contact validation', () => {
  it('accepts Brazilian fixed and mobile numbers with optional country code', () => {
    for (const [input, expected] of [
      ['(11) 2345-6789', '1123456789'],
      ['(21) 98765-4321', '21987654321'],
      ['+55 (31) 3456-7890', '553134567890'],
      ['55 11 98765-4321', '5511987654321'],
      ['(55) 98765-4321', '55987654321'],
    ])
      expect(phoneSchema.parse(input)).toBe(expected);
  });
  it('rejects missing contacts, invalid DDDs, lengths, prefixes and foreign numbers', () => {
    for (const input of [
      '',
      undefined,
      null,
      11999999999,
      '123',
      '(00) 98765-4321',
      '(20) 98765-4321',
      '(11) 1234-5678',
      '(11) 87654-3210',
      '(11) 9999-9999',
      '119876543210000',
      '+1 (11) 98765-4321',
      '+11 98765-4321',
      '+55 98765-4321',
      'abc11987654321',
      '11+98765-4321',
    ])
      expect(phoneSchema.safeParse(input).success, String(input)).toBe(false);
  });
  it('normalizes names without rejecting accents, apostrophes, hyphens or single names', () => {
    expect(nameSchema.parse('  Ana   María  ')).toBe('Ana María');
    for (const name of ['João', '李明', 'Ana D’Ávila', "Maria D'Angelo", 'Jean-Luc', 'José Jr.'])
      expect(nameSchema.safeParse(name).success, name).toBe(true);
    for (const name of ['', '  ', 'A', '---', '123456', 'Ana 123', 'Ana\nMaria', 'A'.repeat(121)])
      expect(nameSchema.safeParse(name).success, name).toBe(false);
  });
  it('normalizes valid email and rejects malformed, missing and oversized addresses', () => {
    expect(emailSchema.parse('  Ana+consulta@EXEMPLO.COM.BR ')).toBe('ana+consulta@exemplo.com.br');
    for (const email of [
      '',
      undefined,
      'ana',
      'ana@',
      'ana exemplo@site.com',
      'a@@site.com',
      'a'.repeat(245) + '@exemplo.com',
    ])
      expect(emailSchema.safeParse(email).success).toBe(false);
  });
  it('uses readable required-field errors', () => {
    for (const [schema, message] of [
      [nameSchema, 'Informe o nome completo.'],
      [emailSchema, 'Informe um e-mail válido.'],
      [phoneSchema, 'Informe um telefone com DDD.'],
    ] as const) {
      const result = schema.safeParse(undefined);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0].message).toBe(message);
    }
  });
});
