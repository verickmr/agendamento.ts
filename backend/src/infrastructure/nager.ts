import { z } from 'zod';
import { AppError } from '../domain/errors.js';
import { dateSchema, type Holiday, type HolidayProvider } from '../domain/schedule.js';

const responseSchema = z.array(z.object({ date: dateSchema, localName: z.string().min(1) }));
export class NagerHolidayProvider implements HolidayProvider {
  constructor(private readonly fetcher: typeof fetch = fetch) {}
  async list(): Promise<Holiday[]> {
    try {
      const response = await this.fetcher('https://date.nager.at/api/v3/PublicHolidays/2026/BR', {
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`Holiday provider HTTP ${response.status}`);
      const holidays = responseSchema.parse(await response.json());
      return holidays.map(({ date, localName }) => ({ date, localName }));
    } catch {
      throw new AppError(
        503,
        'HOLIDAY_UNAVAILABLE',
        'Não foi possível consultar os feriados. Tente novamente em instantes.',
      );
    }
  }
}
