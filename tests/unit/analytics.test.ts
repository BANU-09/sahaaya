import { expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { dailyAdherence } from '@/lib/analytics';
const start = DateTime.fromISO('2026-11-01', { zone: 'Asia/Kolkata' });
it('counts help requests on the patient local date without inventing missed doses', () => {
  const days = dailyAdherence(
    [{ status: 'HELP', scheduledAt: new Date('2026-10-31T19:00:00Z') }],
    start,
    2,
  );
  expect(days[0]).toMatchObject({
    date: '2026-11-01',
    total: 1,
    taken: 0,
    notTaken: 0,
    unconfirmed: 1,
    states: { HELP: 1 },
  });
  expect(days[1].total).toBe(0);
});
it('preserves every status count and excludes cancelled doses from adherence totals', () => {
  const states = ['TAKEN', 'NOT_TAKEN', 'SNOOZED', 'PENDING', 'HELP', 'CANCELLED'];
  const [day] = dailyAdherence(
    states.map((status) => ({ status, scheduledAt: new Date('2026-11-01T02:30:00Z') })),
    start,
    1,
  );
  expect(day).toMatchObject({ total: 5, taken: 1, notTaken: 1, unconfirmed: 3 });
  expect(Object.values(day.states)).toEqual([1, 1, 1, 1, 1]);
});
it('handles local calendar days across a daylight-saving boundary', () => {
  const days = dailyAdherence(
    [{ status: 'TAKEN', scheduledAt: new Date('2026-11-01T06:30:00Z') }],
    DateTime.fromISO('2026-10-31', { zone: 'America/New_York' }),
    3,
  );
  expect(days.map((d) => [d.date, d.total])).toEqual([
    ['2026-10-31', 0],
    ['2026-11-01', 1],
    ['2026-11-02', 0],
  ]);
});
