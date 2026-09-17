import type { RequestHandler } from 'express';
import { TIMEZONE, YEAR } from '../../domain/schedule.js';

export class SystemController {
  constructor(private readonly checkDatabase: () => Promise<void>) {}

  metadata: RequestHandler = (_request, response) => {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const part = (kind: string) => parts.find((item) => item.type === kind)!.value;
    response.json({
      today: `${part('year')}-${part('month')}-${part('day')}`,
      timezone: TIMEZONE,
      year: YEAR,
      serverTime: now.toISOString(),
    });
  };

  health: RequestHandler = async (_request, response) => {
    await this.checkDatabase();
    response.json({ status: 'ok' });
  };
}
