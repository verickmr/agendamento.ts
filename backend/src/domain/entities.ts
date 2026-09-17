export type AppointmentStatus = 'CONFIRMED' | 'CANCELLED';
export interface AppointmentRecord {
  id: string;
  name: string;
  date: Date;
  startMinute: number;
  status: AppointmentStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt: Date | null;
  cancelledBy: string | null;
}
export interface BlockRecord {
  id: string;
  date: Date;
  startMinute: number | null;
  reason: string | null;
  createdAt: Date;
  createdBy: string;
  removedAt: Date | null;
  removedBy: string | null;
}
export interface ReceptionUser {
  id: string;
  name: string;
  email: string;
}
