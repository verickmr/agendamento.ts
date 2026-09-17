import type { AppointmentRecord, AppointmentStatus, BlockRecord } from '../../domain/entities.js';

export type NewAppointment = Pick<
  AppointmentRecord,
  'name' | 'email' | 'phone' | 'date' | 'startMinute'
>;
export type AppointmentChanges = Partial<
  Pick<
    AppointmentRecord,
    'name' | 'date' | 'startMinute' | 'status' | 'cancelledAt' | 'cancelledBy'
  >
>;
export type NewAvailabilityBlock = Pick<
  BlockRecord,
  'date' | 'startMinute' | 'reason' | 'createdBy'
>;

export interface ScheduleTransaction {
  findAppointment(id: string): Promise<AppointmentRecord | null>;
  findOccupied(date: string, startMinute: number, excludeId?: string): Promise<boolean>;
  findOverlappingBlock(date: string, startMinute: number | null): Promise<boolean>;
  appointmentsInPeriod(date: string, startMinute: number | null): Promise<AppointmentRecord[]>;
  insertAppointment(input: NewAppointment): Promise<AppointmentRecord>;
  updateAppointment(
    id: string,
    version: number,
    input: AppointmentChanges,
  ): Promise<AppointmentRecord>;
  insertBlock(input: NewAvailabilityBlock): Promise<BlockRecord>;
  deactivateBlock(id: string, actor: string): Promise<boolean>;
}
export interface ScheduleRepository {
  findAppointment(id: string): Promise<AppointmentRecord | null>;
  findBlock(id: string): Promise<BlockRecord | null>;
  listAppointments(
    date: string | undefined,
    status: AppointmentStatus | 'ALL',
  ): Promise<AppointmentRecord[]>;
  listBlocks(date: string | undefined): Promise<BlockRecord[]>;
  availabilitySnapshot(
    date: string,
  ): Promise<{ occupied: number[]; blocked: Array<number | null> }>;
  withDateLocks<T>(
    dates: string[],
    operation: (transaction: ScheduleTransaction) => Promise<T>,
  ): Promise<T>;
}
