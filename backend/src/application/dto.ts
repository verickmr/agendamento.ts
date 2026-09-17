import type { AppointmentRecord, BlockRecord } from '../domain/entities.js';
import { dateString, minuteToTime, TIMEZONE } from '../domain/schedule.js';

export function appointmentDTO(item: AppointmentRecord) {
  return {
    id: item.id,
    name: item.name,
    date: dateString(item.date),
    time: minuteToTime(item.startMinute),
    endTime: minuteToTime(item.startMinute + 60),
    timezone: TIMEZONE,
    status: item.status,
    version: item.version,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    cancelledAt: item.cancelledAt?.toISOString() ?? null,
  };
}
export function blockDTO(item: BlockRecord) {
  return {
    id: item.id,
    date: dateString(item.date),
    time: item.startMinute === null ? null : minuteToTime(item.startMinute),
    reason: item.reason,
    createdAt: item.createdAt.toISOString(),
  };
}
