import { TIMEZONE } from './schedule.js';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function clinicTime(now: Date) {
  const parts = formatter.formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)!.value;
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    minute: Number(value('hour')) * 60 + Number(value('minute')),
  };
}

export function isFutureSlot(date: string, minute: number, now: Date) {
  const current = clinicTime(now);
  return date > current.date || (date === current.date && minute > current.minute);
}
