import { describe, expect, it } from 'vitest';
import {
  dateSchema,
  timeSchema,
  createSchema,
  patchSchema,
  minuteToTime,
  allSlots,
  businessDay,
} from '../src/domain/schedule.js';

describe('clinic scheduling rules', () => {
  it.each(['2026-02-30', '2026-2-01', '2025-12-31', '2027-01-01', '2026-13-01'])(
    'rejects invalid date %s',
    (value) => {
      expect(dateSchema.safeParse(value).success).toBe(false);
    },
  );
  it('accepts past real dates in 2026', () =>
    expect(dateSchema.parse('2026-01-02')).toBe('2026-01-02'));
  it.each(['07:00', '18:00', '08:30', '8:00', '10:01'])('rejects non slot %s', (value) => {
    expect(timeSchema.safeParse(value).success).toBe(false);
  });
  it('defines ten one-hour slots', () => {
    expect(allSlots).toHaveLength(10);
    expect(allSlots.map(minuteToTime)).toEqual([
      '08:00',
      '09:00',
      '10:00',
      '11:00',
      '12:00',
      '13:00',
      '14:00',
      '15:00',
      '16:00',
      '17:00',
    ]);
    expect(minuteToTime(allSlots[9] + 60)).toBe('18:00');
  });
  it('trims patient names and refuses empty or oversized names', () => {
    expect(createSchema.parse({ name: ' Maria ', date: '2026-01-02', time: '08:00' }).name).toBe(
      'Maria',
    );
    for (const name of ['  ', 'a'.repeat(121)])
      expect(createSchema.safeParse({ name, date: '2026-01-02', time: '08:00' }).success).toBe(
        false,
      );
  });
  it('requires a version and an actual field for edits', () => {
    expect(patchSchema.safeParse({ version: 1 }).success).toBe(false);
    expect(patchSchema.safeParse({ name: 'Maria' }).success).toBe(false);
    expect(patchSchema.safeParse({ name: 'Maria', version: 1 }).success).toBe(true);
  });
  it('closes weekends and every holiday returned by the provider', () => {
    expect(businessDay('2026-01-03', []).isBusinessDay).toBe(false);
    expect(businessDay('2026-01-04', []).isBusinessDay).toBe(false);
    expect(
      businessDay('2026-01-02', [{ date: '2026-01-02', localName: 'Local holiday' }]).isBusinessDay,
    ).toBe(false);
    expect(businessDay('2026-01-02', []).isBusinessDay).toBe(true);
  });
});
