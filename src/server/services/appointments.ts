import { queueCareUpdate } from './outbox';
import type { User } from '@prisma/client';
import { z } from 'zod';
import { db } from '../db';
import { authorize, audit } from '../auth';
import { appointmentSchema } from '@/lib/validation';
import { ApiError } from '../errors';
import { calendarAccessToken, checkedFetch } from '../integrations/google';
import { digest } from '../crypto';
export async function createAppointment(user: User, patientId: string, body: unknown) {
  const data = appointmentSchema.parse(body);
  return db.$transaction(async (tx) => {
    await authorize(user, patientId, 'appointments.manage', tx);
    const item = await tx.appointment.create({
      data: { ...data, patientId, startsAt: new Date(data.startsAt) },
    });
    await audit(patientId, user, 'appointmentCreated', item.id, tx);
    await queueCareUpdate(tx, patientId, 'appointmentUpdated', `appointment:${item.id}:created`);
    return item;
  });
}
export async function updateAppointment(user: User, patientId: string, id: string, body: unknown) {
  const data = z
    .object({
      status: z.enum(['REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
      startsAt: z.iso.datetime({ offset: true }).optional(),
      confirmationReference: z.string().min(3).max(300).optional(),
      notes: z.string().max(3000).optional(),
    })
    .parse(body);
  if (data.status === 'CONFIRMED' && !data.confirmationReference)
    throw new ApiError(400, 'invalidInput');
  return db.$transaction(async (tx) => {
    await authorize(user, patientId, 'appointments.manage', tx);
    const changed = await tx.appointment.updateMany({
      where: { id, patientId },
      data: { ...data, startsAt: data.startsAt ? new Date(data.startsAt) : undefined },
    });
    if (!changed.count) throw new ApiError(404, 'notFound');
    await audit(patientId, user, 'appointmentUpdated', id, tx);
    await queueCareUpdate(
      tx,
      patientId,
      'appointmentUpdated',
      `appointment:${id}:${new Date().toISOString()}`,
    );
    return tx.appointment.findUnique({ where: { id } });
  });
}
export async function syncCalendar(user: User, patientId: string, id: string) {
  await authorize(user, patientId, 'appointments.manage');
  if (user.demo) throw new ApiError(403, 'forbidden');
  const appointment = await db.appointment.findFirst({ where: { id, patientId } });
  if (!appointment) throw new ApiError(404, 'notFound');
  const account = await db.googleAccount.findFirst({
    where: {
      userId: user.id,
      encryptedRefreshToken: { not: null },
      scopes: { contains: 'calendar.events' },
    },
  });
  if (!account?.encryptedRefreshToken) throw new ApiError(503, 'reconnectGoogle');
  if (appointment.calendarAccountId && appointment.calendarAccountId !== account.id)
    throw new ApiError(403, 'forbidden');
  const accessToken = await calendarAccessToken(account.encryptedRefreshToken);
  const eventId = appointment.calendarEventId || digest(`sahaaya:${id}:${user.id}`);
  const base = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  if (appointment.status === 'CANCELLED') {
    const result = await fetch(`${base}/${eventId}`, {
      method: 'DELETE',
      headers,
      signal: AbortSignal.timeout(20000),
    });
    if (!result.ok && result.status !== 404 && result.status !== 410)
      throw new ApiError(502, 'providerError');
  } else {
    const content = {
      summary: 'Sahaaya appointment',
      location: appointment.location,
      start: { dateTime: appointment.startsAt.toISOString() },
      end: { dateTime: new Date(appointment.startsAt.getTime() + 30 * 60000).toISOString() },
      description: 'View private care details in Sahaaya.',
    };
    if (appointment.calendarEventId)
      await checkedFetch(`${base}/${eventId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(content),
      });
    else {
      const result = await fetch(base, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...content, id: eventId }),
        signal: AbortSignal.timeout(20000),
      });
      if (!result.ok && result.status !== 409) throw new ApiError(502, 'providerError');
    }
  }
  await db.appointment.update({
    where: { id },
    data: { calendarEventId: eventId, calendarAccountId: account.id },
  });
  return { message: 'saved' };
}
