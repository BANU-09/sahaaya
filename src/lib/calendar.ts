/** RFC 5545 export: no patient name, clinical notes, diagnosis or medication details. */
export function appointmentCalendar(appointment: {
  id: string;
  startsAt: Date;
  updatedAt: Date;
  status: string;
}) {
  const stamp = (date: Date) =>
    date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z');
  // Encode the stable opaque ID so untrusted text cannot inject iCalendar properties.
  const uid = `${encodeURIComponent(appointment.id)}@sahaaya`;
  const status = appointment.status === 'CANCELLED' ? 'CANCELLED' : 'TENTATIVE';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BanuSreya//SAHAAYA//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp(appointment.updatedAt)}`,
    `LAST-MODIFIED:${stamp(appointment.updatedAt)}`,
    `DTSTART:${stamp(appointment.startsAt)}`,
    `DTEND:${stamp(new Date(appointment.startsAt.getTime() + 30 * 60000))}`,
    'SUMMARY:SAHAAYA appointment',
    'DESCRIPTION:Open SAHAAYA for details. Confirm the visit with your clinic.',
    `STATUS:${appointment.status === 'CONFIRMED' || appointment.status === 'COMPLETED' ? 'CONFIRMED' : status}`,
    'CLASS:PRIVATE',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
