import { DateTime } from 'luxon';
import { adherence } from './schedule';
export const DOSE_STATES = ['TAKEN', 'NOT_TAKEN', 'PENDING', 'SNOOZED', 'HELP'] as const;
export function dailyAdherence(
  events: { status: string; scheduledAt: Date }[],
  start: DateTime,
  days: number,
) {
  const byDay = new Map<string, typeof events>();
  for (const event of events) {
    const date = DateTime.fromJSDate(event.scheduledAt, {
      zone: start.zoneName || 'UTC',
    }).toISODate()!;
    const entries = byDay.get(date) || [];
    entries.push(event);
    byDay.set(date, entries);
  }
  return Array.from({ length: days }, (_, i) => {
    const date = start.plus({ days: i }).toISODate()!;
    const records = byDay.get(date) || [];
    return {
      date,
      ...adherence(records),
      states: Object.fromEntries(
        DOSE_STATES.map((state) => [state, records.filter((r) => r.status === state).length]),
      ),
    };
  });
}
