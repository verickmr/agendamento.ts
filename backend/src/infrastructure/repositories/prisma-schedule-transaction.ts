import type { Prisma } from '@prisma/client';
import type {
  ScheduleTransaction,
  NewAppointment,
  AppointmentChanges,
  NewAvailabilityBlock,
} from '../../application/repositories/schedule-repository.js';
import { toDate } from '../../domain/schedule.js';

export class PrismaScheduleTransaction implements ScheduleTransaction {
  constructor(private readonly tx: Prisma.TransactionClient) {}
  findAppointment(id: string) {
    return this.tx.appointment.findUnique({ where: { id } });
  }
  async findOccupied(date: string, startMinute: number, excludeId?: string) {
    return Boolean(
      await this.tx.appointment.findFirst({
        where: {
          date: toDate(date),
          startMinute,
          status: 'CONFIRMED',
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      }),
    );
  }
  async findOverlappingBlock(date: string, startMinute: number | null) {
    return Boolean(
      await this.tx.availabilityBlock.findFirst({
        where: {
          date: toDate(date),
          removedAt: null,
          ...(startMinute === null ? {} : { OR: [{ startMinute: null }, { startMinute }] }),
        },
        select: { id: true },
      }),
    );
  }
  appointmentsInPeriod(date: string, startMinute: number | null) {
    return this.tx.appointment.findMany({
      where: {
        date: toDate(date),
        status: 'CONFIRMED',
        ...(startMinute === null ? {} : { startMinute }),
      },
      orderBy: { startMinute: 'asc' },
    });
  }
  insertAppointment(input: NewAppointment) {
    return this.tx.appointment.create({ data: input });
  }
  updateAppointment(id: string, version: number, input: AppointmentChanges) {
    return this.tx.appointment.update({
      where: { id, version },
      data: { ...input, version: { increment: 1 } },
    });
  }
  insertBlock(input: NewAvailabilityBlock) {
    return this.tx.availabilityBlock.create({ data: input });
  }
  async deactivateBlock(id: string, actor: string) {
    const result = await this.tx.availabilityBlock.updateMany({
      where: { id, removedAt: null },
      data: { removedAt: new Date(), removedBy: actor },
    });
    return result.count > 0;
  }
}
