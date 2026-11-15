import { describe, it, expect } from 'vitest';
import {
  generateSchedule,
  canTransition,
  remainingStock,
  estimatedDaysOfSupply,
  careStage,
  isQuietHour,
  adherence,
  type Schedule,
} from '@/lib/schedule';
const schedule: Schedule = {
  frequency: 'DAILY',
  times: ['08:00', '20:00'],
  weekdays: [],
  startDate: '2026-11-15',
  endDate: null,
  timezone: 'Asia/Kolkata',
};
describe('medication schedules', () => {
  it('converts local times to UTC and emits two doses per day', () => {
    const dates = generateSchedule(schedule, new Date('2026-11-15T00:00:00Z'), 2);
    expect(dates.map((d) => d.toISOString())).toEqual([
      '2026-11-15T02:30:00.000Z',
      '2026-11-15T14:30:00.000Z',
      '2026-11-16T02:30:00.000Z',
      '2026-11-16T14:30:00.000Z',
    ]);
  });
  it('does not schedule as-needed medicines', () =>
    expect(generateSchedule({ ...schedule, frequency: 'PRN' }, new Date())).toEqual([]));
  it('supports multiple selected weekdays', () => {
    const result = generateSchedule(
      { ...schedule, frequency: 'WEEKDAYS', weekdays: [1, 3] },
      new Date('2026-11-15'),
      7,
    );
    expect(result).toHaveLength(4);
    expect(result[0].toISOString()).toBe('2026-11-16T02:30:00.000Z');
  });
  it('anchors alternate days to the original start date', () => {
    const dates = generateSchedule(
      { ...schedule, frequency: 'ALTERNATE', times: ['08:00'] },
      new Date('2026-11-16'),
      5,
    );
    expect(dates.map((d) => d.toISOString().slice(0, 10))).toEqual(['2026-11-17', '2026-11-19']);
  });
  it('does not emit before start or after a temporary course ends', () =>
    expect(
      generateSchedule(
        { ...schedule, startDate: '2026-11-16', endDate: '2026-11-17' },
        new Date('2026-11-15'),
        5,
      ),
    ).toHaveLength(4));
  it('deduplicates duplicate reminder times', () =>
    expect(
      generateSchedule({ ...schedule, times: ['08:00', '08:00'] }, new Date('2026-11-15'), 1),
    ).toHaveLength(1));
  it('omits a nonexistent DST local time', () =>
    expect(
      generateSchedule(
        { ...schedule, startDate: '2026-03-08', timezone: 'America/New_York', times: ['02:30'] },
        new Date('2026-03-08T12:00:00Z'),
        1,
      ),
    ).toHaveLength(0));
  it('does not duplicate a repeated DST hour', () =>
    expect(
      generateSchedule(
        { ...schedule, startDate: '2026-11-01', timezone: 'America/New_York', times: ['01:30'] },
        new Date('2026-11-01T12:00:00Z'),
        1,
      ),
    ).toHaveLength(1));
  it.each([0, 94])('rejects unbounded day count %s', (days) =>
    expect(() => generateSchedule(schedule, new Date(), days)).toThrow(),
  );
  it('rejects invalid dates and time zones', () => {
    expect(() => generateSchedule({ ...schedule, startDate: 'bad' }, new Date())).toThrow();
    expect(() => generateSchedule({ ...schedule, timezone: 'Bad/Zone' }, new Date())).toThrow();
  });
});
describe('dose transitions and stock', () => {
  it('estimates supply from multiple daily doses and units', () => {
    expect(estimatedDaysOfSupply(schedule, 30, 1.5)).toBe(10);
    expect(estimatedDaysOfSupply(schedule, 0, 1)).toBe(0);
  });
  it('estimates selected and alternate days without duplicating entries', () => {
    expect(
      estimatedDaysOfSupply({ ...schedule, frequency: 'WEEKDAYS', weekdays: [1, 3, 1] }, 8, 1),
    ).toBe(14);
    expect(estimatedDaysOfSupply({ ...schedule, frequency: 'ALTERNATE' }, 7, 1)).toBe(7);
    expect(estimatedDaysOfSupply({ ...schedule, times: ['08:00', '08:00'] }, 7, 1)).toBe(7);
  });
  it('does not invent supply duration for as-needed or empty schedules', () => {
    expect(estimatedDaysOfSupply({ ...schedule, frequency: 'PRN' }, 30, 1)).toBeNull();
    expect(estimatedDaysOfSupply({ ...schedule, times: [] }, 30, 1)).toBeNull();
  });
  it.each(['TAKEN', 'NOT_TAKEN', 'CANCELLED'])(
    'cannot confirm or snooze terminal %s doses',
    (state) => {
      expect(canTransition(state, 'TAKEN')).toBe(false);
      expect(canTransition(state, 'SNOOZED')).toBe(false);
    },
  );
  it.each(['PENDING', 'SNOOZED', 'HELP'])('permits a human resolution from %s', (state) =>
    expect(canTransition(state, 'TAKEN')).toBe(true),
  );
  it('subtracts only confirmed consumption and adds refills', () =>
    expect(remainingStock(30, [10, 15], 8, 1.5)).toBe(43));
  it('does not display negative estimated stock', () =>
    expect(remainingStock(1, [], 8, 1)).toBe(0));
  it('distinguishes unconfirmed from reported not taken', () =>
    expect(
      adherence([
        { status: 'PENDING' },
        { status: 'SNOOZED' },
        { status: 'TAKEN' },
        { status: 'NOT_TAKEN' },
        { status: 'CANCELLED' },
      ]),
    ).toEqual({ total: 4, taken: 1, notTaken: 1, unconfirmed: 2 }));
});
describe('care loop and notification timing', () => {
  const due = new Date('2026-11-15T08:00:00Z');
  it.each([
    [-1, null],
    [0, 'DUE'],
    [14, 'DUE'],
    [15, 'FOLLOWUP'],
    [29, 'FOLLOWUP'],
    [30, 'ESCALATED'],
  ])('uses configured boundary %s minutes', (minutes, stage) =>
    expect(careStage(due, new Date(due.getTime() + Number(minutes) * 60000), 15, 30)).toBe(stage),
  );
  it('respects an active snooze', () =>
    expect(
      careStage(due, new Date('2026-11-15T08:35:00Z'), 15, 30, new Date('2026-11-15T08:40:00Z')),
    ).toBe(null));
  it('resumes escalation when snooze expires', () =>
    expect(
      careStage(due, new Date('2026-11-15T08:40:00Z'), 15, 30, new Date('2026-11-15T08:40:00Z')),
    ).toBe('ESCALATED'));
  it('uses the recipient timezone for overnight quiet hours', () => {
    expect(isQuietHour(new Date('2026-11-15T18:00:00Z'), 'Asia/Kolkata', 22, 7)).toBe(true);
    expect(isQuietHour(new Date('2026-11-15T06:00:00Z'), 'Asia/Kolkata', 22, 7)).toBe(false);
  });
  it('supports daytime quiet hours or disabling quiet hours', () => {
    expect(isQuietHour(new Date('2026-11-15T08:00:00Z'), 'UTC', 7, 9)).toBe(true);
    expect(isQuietHour(new Date(), 'UTC', 0, 0)).toBe(false);
  });
});
