import { DateTime } from 'luxon';
export type Frequency = 'DAILY' | 'WEEKDAYS' | 'ALTERNATE' | 'PRN';
export type Schedule = {
  frequency: string;
  times: string[];
  weekdays: number[];
  startDate: string;
  endDate: string | null;
  timezone: string;
};
export function generateSchedule(schedule: Schedule, from: Date, days = 8): Date[] {
  if (schedule.frequency === 'PRN') return [];
  const start = DateTime.fromISO(schedule.startDate, { zone: schedule.timezone }).startOf('day');
  const day = DateTime.fromJSDate(from, { zone: schedule.timezone }).startOf('day');
  if (!start.isValid || !day.isValid || days < 1 || days > 93) throw new Error('Invalid schedule');
  const result = new Map<number, Date>();
  for (let i = 0; i < days; i++) {
    const date = day.plus({ days: i });
    const iso = date.toISODate()!;
    if (iso < schedule.startDate || (schedule.endDate && iso > schedule.endDate)) continue;
    if (schedule.frequency === 'WEEKDAYS' && !schedule.weekdays.includes(date.weekday)) continue;
    if (schedule.frequency === 'ALTERNATE' && Math.round(date.diff(start, 'days').days) % 2)
      continue;
    for (const time of schedule.times) {
      const [hour, minute] = time.split(':').map(Number);
      const at = date.set({ hour, minute, second: 0, millisecond: 0 });
      // Nonexistent DST times are deliberately omitted; a time repeated in autumn is emitted once.
      if (at.hour !== hour || at.minute !== minute) continue;
      result.set(at.toMillis(), at.toJSDate());
    }
  }
  return [...result.values()].sort((a, b) => a.getTime() - b.getTime());
}
export const DOSE_ACTIONS = ['TAKEN', 'SNOOZED', 'NOT_TAKEN', 'HELP'] as const;
export type DoseAction = (typeof DOSE_ACTIONS)[number];
export function canTransition(status: string, action: DoseAction) {
  return !['TAKEN', 'NOT_TAKEN', 'CANCELLED'].includes(status) && DOSE_ACTIONS.includes(action);
}
export function remainingStock(initial: number, refills: number[], taken: number, units: number) {
  return Math.max(0, initial + refills.reduce((a, b) => a + b, 0) - taken * units);
}
export function estimatedDaysOfSupply(schedule: Schedule, stock: number, unitsPerDose: number) {
  if (schedule.frequency === 'PRN') return null;
  const daysPerWeek =
    schedule.frequency === 'WEEKDAYS'
      ? new Set(schedule.weekdays).size
      : schedule.frequency === 'ALTERNATE'
        ? 3.5
        : 7;
  const dailyUnits = (new Set(schedule.times).size * unitsPerDose * daysPerWeek) / 7;
  return dailyUnits > 0 ? Math.floor(stock / dailyUnits) : null;
}
export function careStage(
  scheduledAt: Date,
  now: Date,
  followup: number,
  escalate: number,
  snoozedUntil?: Date | null,
) {
  if (snoozedUntil && snoozedUntil > now) return null;
  const minutes = (now.getTime() - scheduledAt.getTime()) / 60_000;
  if (minutes < 0) return null;
  return minutes >= escalate ? 'ESCALATED' : minutes >= followup ? 'FOLLOWUP' : 'DUE';
}
export function isQuietHour(now: Date, timezone: string, start: number, end: number) {
  const hour = DateTime.fromJSDate(now, { zone: timezone }).hour;
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}
export function adherence(events: { status: string }[]) {
  const eligible = events.filter((e) => e.status !== 'CANCELLED');
  return {
    total: eligible.length,
    taken: eligible.filter((e) => e.status === 'TAKEN').length,
    notTaken: eligible.filter((e) => e.status === 'NOT_TAKEN').length,
    unconfirmed: eligible.filter((e) => !['TAKEN', 'NOT_TAKEN'].includes(e.status)).length,
  };
}
