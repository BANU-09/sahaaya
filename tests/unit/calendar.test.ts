import { describe, expect, it } from 'vitest';
import { appointmentCalendar } from '@/lib/calendar';
const fixture = {
  id: 'appointment-fixture',
  startsAt: new Date('2026-11-15T10:00:00+05:30'),
  updatedAt: new Date('2026-11-14T12:00:00Z'),
  status: 'REQUESTED',
};
describe('private calendar export', () => {
  it('exports UTC times, a 30-minute duration and a tentative unconfirmed visit', () => {
    const text = appointmentCalendar(fixture);
    expect(text).toContain('DTSTART:20261115T043000Z\r\nDTEND:20261115T050000Z');
    expect(text).toContain('STATUS:TENTATIVE');
    expect(text).toContain('CLASS:PRIVATE');
    expect(text.split('\r\n').every((line) => Buffer.byteLength(line) <= 75)).toBe(true);
  });
  it.each(['CONFIRMED', 'COMPLETED', 'CANCELLED'])('preserves the %s lifecycle', (status) => {
    expect(appointmentCalendar({ ...fixture, status })).toContain(
      `STATUS:${status === 'COMPLETED' ? 'CONFIRMED' : status}`,
    );
  });
  it('uses a stable UID when an appointment is rescheduled', () => {
    const moved = appointmentCalendar({ ...fixture, startsAt: new Date('2026-12-01T10:00:00Z') });
    expect(moved.match(/^UID:.+$/m)?.[0]).toBe(
      appointmentCalendar(fixture).match(/^UID:.+$/m)?.[0],
    );
  });
  it('does not export private fields or allow property injection through IDs', () => {
    const text = appointmentCalendar({
      ...fixture,
      id: 'x\r\nATTENDEE:attacker@example.invalid',
      ...{ doctor: 'Private Doctor', purpose: 'Sensitive diagnosis', location: 'Private home' },
    });
    expect(text).not.toMatch(/\r\nATTENDEE:/);
    expect(text).not.toContain('Private Doctor');
    expect(text).not.toContain('Sensitive diagnosis');
    expect(text).not.toContain('Private home');
  });
});
