import { describe, expect, it, vi } from 'vitest';
import { ScheduleService } from '../src/application/schedule-service.js';
import type {
  ScheduleRepository,
  ScheduleTransaction,
} from '../src/application/repositories/schedule-repository.js';
import type { AppointmentRecord } from '../src/domain/entities.js';
import { clinicTime, isFutureSlot } from '../src/domain/clinic-time.js';
import { createSchema } from '../src/domain/schedule.js';

const contact = { name: 'Ana', email: 'ana@example.com', phone: '11999999999' };
const record: AppointmentRecord = {
  id: 'a',
  ...contact,
  date: new Date('2026-09-17T00:00:00Z'),
  startMinute: 600,
  status: 'CONFIRMED',
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  cancelledAt: null,
  cancelledBy: null,
};
function setup(instant = '2026-09-17T13:00:00Z') {
  const now = vi.fn(() => new Date(instant));
  const tx: ScheduleTransaction = {
    findAppointment: vi.fn(async () => record),
    findOccupied: vi.fn(async () => false),
    findOverlappingBlock: vi.fn(async () => false),
    appointmentsInPeriod: vi.fn(async () => []),
    insertAppointment: vi.fn(async () => record),
    updateAppointment: vi.fn(async () => record),
    insertBlock: vi.fn(),
    deactivateBlock: vi.fn(async () => true),
  };
  const repository: ScheduleRepository = {
    findAppointment: vi.fn(async () => record),
    findBlock: vi.fn(),
    listAppointments: vi.fn(async () => []),
    listBlocks: vi.fn(async () => []),
    availabilitySnapshot: vi.fn(async () => ({ occupied: [], blocked: [] })),
    withDateLocks: vi.fn(async (_dates, operation) => operation(tx)),
  };
  const holidays = { list: vi.fn(async () => []) };
  return { service: new ScheduleService(repository, holidays, now), now, tx, repository, holidays };
}
describe('future booking policy', () => {
  it('uses the clinic date across the UTC midnight boundary', () => {
    expect(clinicTime(new Date('2026-09-18T01:30:00Z'))).toEqual({
      date: '2026-09-17',
      minute: 1350,
    });
    expect(clinicTime(new Date('2026-09-18T03:00:00Z'))).toEqual({ date: '2026-09-18', minute: 0 });
  });
  it('closes a slot exactly when it starts', () => {
    expect(isFutureSlot('2026-09-17', 600, new Date('2026-09-17T12:59:59.999Z'))).toBe(true);
    expect(isFutureSlot('2026-09-17', 600, new Date('2026-09-17T13:00:00Z'))).toBe(false);
  });
  it('returns only future slots today and no slots on an earlier date', async () => {
    const { service } = setup();
    expect((await service.available('2026-09-17')).slots.map((s) => s.start)).toEqual([
      '11:00',
      '12:00',
      '13:00',
      '14:00',
      '15:00',
      '16:00',
      '17:00',
    ]);
    expect((await service.available('2026-09-16')).slots).toEqual([]);
    expect((await service.available('2026-09-18')).slots).toHaveLength(10);
  });
  it('returns an explanation after the last start time today', async () => {
    const { service } = setup('2026-09-17T20:00:00Z');
    expect(await service.available('2026-09-17')).toMatchObject({
      slots: [],
      reason: expect.stringContaining('encerraram'),
    });
  });
  it('rejects past creation before contacting the provider or database', async () => {
    const { service, repository, holidays } = setup();
    await expect(
      service.create({ ...contact, date: '2026-09-16', time: '17:00' }),
    ).rejects.toMatchObject({ code: 'PAST_SLOT', status: 422 });
    expect(repository.withDateLocks).not.toHaveBeenCalled();
    expect(holidays.list).not.toHaveBeenCalled();
  });
  it('checks the time again after waiting for the transaction', async () => {
    const { service, now, tx } = setup('2026-09-17T12:59:59Z');
    vi.mocked(tx.findOccupied).mockImplementation(async () => {
      now.mockReturnValue(new Date('2026-09-17T13:00:00Z'));
      return false;
    });
    await expect(
      service.create({ ...contact, date: '2026-09-17', time: '10:00' }),
    ).rejects.toMatchObject({ code: 'PAST_SLOT' });
    expect(tx.insertAppointment).not.toHaveBeenCalled();
  });
  it('rejects rescheduling to the past but allows a historical name correction', async () => {
    const { service, tx } = setup();
    await expect(
      service.update('a', { date: '2026-09-16', time: '09:00', version: 1 }),
    ).rejects.toMatchObject({ code: 'PAST_SLOT' });
    expect(tx.updateAppointment).not.toHaveBeenCalled();
    await service.update('a', { name: 'Ana corrigida', version: 1 });
    expect(tx.updateAppointment).toHaveBeenCalledWith(
      'a',
      1,
      expect.objectContaining({ name: 'Ana corrigida' }),
    );
  });
  it('normalizes contact details and rejects missing or invalid contacts', () => {
    const input = { ...contact, date: '2026-09-18', time: '09:00' };
    expect(
      createSchema.parse({ ...input, email: ' ANA@EXAMPLE.COM ', phone: '+55 (11) 99999-9999' }),
    ).toMatchObject({ email: 'ana@example.com', phone: '5511999999999' });
    for (const patch of [
      { email: '' },
      { email: 'invalid' },
      { phone: '123' },
      { phone: 'abc11999999999' },
      { email: undefined },
      { phone: undefined },
    ])
      expect(createSchema.safeParse({ ...input, ...patch }).success).toBe(false);
  });
});
