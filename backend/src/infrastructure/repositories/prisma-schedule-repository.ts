import { Prisma, type PrismaClient } from '@prisma/client';
import type {
  ScheduleRepository,
  ScheduleTransaction,
} from '../../application/repositories/schedule-repository.js';
import type { AppointmentStatus } from '../../domain/entities.js';
import { AppError } from '../../domain/errors.js';
import { toDate } from '../../domain/schedule.js';
import { PrismaScheduleTransaction } from './prisma-schedule-transaction.js';

export class PrismaScheduleRepository implements ScheduleRepository {
  constructor(private readonly db: PrismaClient) {}
  findAppointment(id: string) {
    return this.db.appointment.findUnique({ where: { id } });
  }
  findBlock(id: string) {
    return this.db.availabilityBlock.findUnique({ where: { id } });
  }
  listAppointments(date: string | undefined, status: AppointmentStatus | 'ALL') {
    return this.db.appointment.findMany({
      where: { ...(date ? { date: toDate(date) } : {}), ...(status === 'ALL' ? {} : { status }) },
      orderBy: [{ date: 'asc' }, { startMinute: 'asc' }, { createdAt: 'asc' }],
    });
  }
  listBlocks(date: string | undefined) {
    return this.db.availabilityBlock.findMany({
      where: { ...(date ? { date: toDate(date) } : {}), removedAt: null },
      orderBy: [{ date: 'asc' }, { startMinute: 'asc' }, { createdAt: 'asc' }],
    });
  }
  async availabilitySnapshot(date: string) {
    const [appointments, blocks] = await this.db.$transaction(
      [
        this.db.appointment.findMany({
          where: { date: toDate(date), status: 'CONFIRMED' },
          select: { startMinute: true },
        }),
        this.db.availabilityBlock.findMany({
          where: { date: toDate(date), removedAt: null },
          select: { startMinute: true },
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      occupied: appointments.map((item) => item.startMinute),
      blocked: blocks.map((item) => item.startMinute),
    };
  }
  async withDateLocks<T>(
    dates: string[],
    operation: (tx: ScheduleTransaction) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.db.$transaction(
        async (tx) => {
          // All occupancy mutations share a namespace and take unique dates in order.
          for (const date of [...new Set(dates)].sort()) {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(2026, ${Number(date.replaceAll('-', ''))}::integer)::text`;
          }
          return operation(new PrismaScheduleTransaction(tx));
        },
        { maxWait: 10000, timeout: 15000 },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new AppError(
          409,
          'SLOT_UNAVAILABLE',
          'Este horário não está mais disponível. Escolha outro.',
        );
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025')
        throw new AppError(
          409,
          'STALE_VERSION',
          'Este agendamento foi alterado. Atualize a lista e tente novamente.',
        );
      throw error;
    }
  }
}
