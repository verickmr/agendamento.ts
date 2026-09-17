import type { AppointmentRecord } from '../domain/entities.js';
import type {
  ScheduleRepository,
  ScheduleTransaction,
} from './repositories/schedule-repository.js';
import { AppError } from '../domain/errors.js';
import {
  allSlots,
  businessDay,
  dateString,
  minuteToTime,
  timeToMinute,
  toDate,
  TIMEZONE,
  type HolidayProvider,
  type CreateAppointment,
  type PatchAppointment,
  type CreateBlock,
} from '../domain/schedule.js';
import { appointmentDTO, blockDTO } from './dto.js';

const conflict = () =>
  new AppError(409, 'SLOT_UNAVAILABLE', 'Este horário não está mais disponível. Escolha outro.');
export class ScheduleService {
  constructor(
    private readonly repository: ScheduleRepository,
    private readonly holidays: HolidayProvider,
  ) {}
  private async loadHolidays() {
    try {
      return await this.holidays.list();
    } catch {
      throw new AppError(
        503,
        'HOLIDAY_UNAVAILABLE',
        'Não foi possível consultar os feriados. Tente novamente em instantes.',
      );
    }
  }
  private async assertBusinessDay(date: string) {
    const info = businessDay(date, await this.loadHolidays());
    if (!info.isBusinessDay) throw new AppError(422, 'CLOSED_DAY', info.reason!);
  }
  private async ensureSlotAvailable(
    transaction: ScheduleTransaction,
    date: string,
    startMinute: number,
    excludeId?: string,
  ) {
    const occupied = await transaction.findOccupied(date, startMinute, excludeId);
    const blocked = await transaction.findOverlappingBlock(date, startMinute);
    if (occupied || blocked) throw conflict();
  }
  private ensureEditableAppointment(
    appointment: AppointmentRecord | null,
    version: number,
  ): asserts appointment is AppointmentRecord {
    if (!appointment) throw new AppError(404, 'NOT_FOUND', 'Agendamento não encontrado.');
    if (appointment.version !== version)
      throw new AppError(
        409,
        'STALE_VERSION',
        'Este agendamento foi alterado. Atualize a lista e tente novamente.',
      );
    if (appointment.status !== 'CONFIRMED')
      throw new AppError(
        409,
        'ALREADY_CANCELLED',
        'Agendamentos cancelados não podem ser alterados.',
      );
  }
  async available(date: string) {
    const holidays = await this.loadHolidays();
    const day = businessDay(date, holidays);
    const snapshot = await this.repository.availabilitySnapshot(date);
    const wholeDay = snapshot.blocked.includes(null);
    const occupiedMinutes = new Set(snapshot.occupied);
    const blockedMinutes = new Set(
      wholeDay ? allSlots : snapshot.blocked.filter((minute): minute is number => minute !== null),
    );
    const slots = day.isBusinessDay
      ? allSlots
          .filter((minute) => !occupiedMinutes.has(minute) && !blockedMinutes.has(minute))
          .map((minute) => ({ start: minuteToTime(minute), end: minuteToTime(minute + 60) }))
      : [];
    const reason =
      day.reason ??
      (wholeDay
        ? 'Agenda bloqueada para este dia.'
        : slots.length === 0
          ? 'Não há horários disponíveis para este dia.'
          : null);
    return {
      date,
      timezone: TIMEZONE,
      isBusinessDay: day.isBusinessDay,
      reason,
      slots,
      occupied: [...occupiedMinutes].sort((a, b) => a - b).map(minuteToTime),
      blocked: [...blockedMinutes].sort((a, b) => a - b).map(minuteToTime),
      holidays,
    };
  }
  async list(date: string | undefined, status: 'CONFIRMED' | 'CANCELLED' | 'ALL') {
    const appointments = await this.repository.listAppointments(date, status);
    return { appointments: appointments.map(appointmentDTO) };
  }
  async create(input: CreateAppointment) {
    await this.assertBusinessDay(input.date);
    return this.repository.withDateLocks([input.date], async (transaction) => {
      const startMinute = timeToMinute(input.time);
      await this.ensureSlotAvailable(transaction, input.date, startMinute);
      const appointment = await transaction.insertAppointment({
        name: input.name,
        date: toDate(input.date),
        startMinute,
      });
      return appointmentDTO(appointment);
    });
  }
  async update(id: string, input: PatchAppointment) {
    const initial = await this.repository.findAppointment(id);
    this.ensureEditableAppointment(initial, input.version);
    const oldDate = dateString(initial.date);
    const targetDate = input.date ?? oldDate;
    if (input.date !== undefined || input.time !== undefined)
      await this.assertBusinessDay(targetDate);
    return this.repository.withDateLocks([oldDate, targetDate], async (transaction) => {
      const current = await transaction.findAppointment(id);
      this.ensureEditableAppointment(current, input.version);
      const startMinute = input.time === undefined ? current.startMinute : timeToMinute(input.time);
      await this.ensureSlotAvailable(transaction, targetDate, startMinute, id);
      const appointment = await transaction.updateAppointment(id, input.version, {
        name: input.name,
        date: toDate(targetDate),
        startMinute,
      });
      return appointmentDTO(appointment);
    });
  }
  async cancel(id: string, version: number, actor: string) {
    const initial = await this.repository.findAppointment(id);
    this.ensureEditableAppointment(initial, version);
    return this.repository.withDateLocks([dateString(initial.date)], async (transaction) => {
      const current = await transaction.findAppointment(id);
      this.ensureEditableAppointment(current, version);
      const appointment = await transaction.updateAppointment(id, version, {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy: actor,
      });
      return appointmentDTO(appointment);
    });
  }
  async listBlocks(date: string | undefined) {
    const blocks = await this.repository.listBlocks(date);
    return { blocks: blocks.map(blockDTO) };
  }
  async createBlock(input: CreateBlock, actor: string) {
    return this.repository.withDateLocks([input.date], async (transaction) => {
      const startMinute = input.time == null ? null : timeToMinute(input.time);
      const appointments = await transaction.appointmentsInPeriod(input.date, startMinute);
      if (appointments.length)
        throw new AppError(
          409,
          'BLOCK_APPOINTMENT_CONFLICT',
          'Existem agendamentos confirmados neste período.',
          { appointments: appointments.map(appointmentDTO) },
        );
      const overlap = await transaction.findOverlappingBlock(input.date, startMinute);
      if (overlap)
        throw new AppError(409, 'BLOCK_OVERLAP', 'Já existe um bloqueio neste período.', {
          appointments: [],
        });
      const block = await transaction.insertBlock({
        date: toDate(input.date),
        startMinute,
        reason: input.reason || null,
        createdBy: actor,
      });
      return blockDTO(block);
    });
  }
  async removeBlock(id: string, actor: string) {
    const initial = await this.repository.findBlock(id);
    if (!initial || initial.removedAt)
      throw new AppError(404, 'NOT_FOUND', 'Bloqueio não encontrado.');
    await this.repository.withDateLocks([dateString(initial.date)], async (transaction) => {
      const removed = await transaction.deactivateBlock(id, actor);
      if (!removed) throw new AppError(404, 'NOT_FOUND', 'Bloqueio não encontrado.');
    });
  }
}
