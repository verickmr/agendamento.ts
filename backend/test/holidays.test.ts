import { describe, expect, it, vi } from 'vitest';
import { NagerHolidayProvider } from '../src/infrastructure/nager.js';

describe('Nager provider', () => {
  it('fetches the real year/country endpoint on each request with no cache', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () =>
          new Response(
            JSON.stringify([{ date: '2026-01-01', localName: 'Confraternização', global: true }]),
          ),
      );
    const provider = new NagerHolidayProvider(fetcher);
    expect(await provider.list()).toEqual([{ date: '2026-01-01', localName: 'Confraternização' }]);
    await provider.list();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][0]).toBe('https://date.nager.at/api/v3/PublicHolidays/2026/BR');
    expect(fetcher.mock.calls[0][1]?.cache).toBe('no-store');
  });
  it.each([
    new Response('bad', { status: 503 }),
    new Response('{}'),
    new Response('[{"date":"2026-02-30","localName":"x"}]'),
  ])('fails closed on invalid upstream response', async (response) => {
    const provider = new NagerHolidayProvider(async () => response);
    await expect(provider.list()).rejects.toMatchObject({
      status: 503,
      code: 'HOLIDAY_UNAVAILABLE',
    });
  });
  it('fails closed on network timeout', async () => {
    const provider = new NagerHolidayProvider(async () => {
      throw new DOMException('timeout', 'TimeoutError');
    });
    await expect(provider.list()).rejects.toMatchObject({ status: 503 });
  });
});
