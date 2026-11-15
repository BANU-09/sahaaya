import { z } from 'zod';
import type { User, Prisma } from '@prisma/client';
import { db } from '../db';
import { authorize, audit, rateLimit } from '../auth';
import { ApiError } from '../errors';
import { appointmentSchema, journalSchema } from '@/lib/validation';
import { queueCareUpdate } from './outbox';
const draftSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('JOURNAL'), payload: journalSchema }),
  z.object({ kind: z.literal('APPOINTMENT'), payload: appointmentSchema }),
]);
export async function companionDraft(
  user: User,
  patientId: string,
  id: string | undefined,
  body: unknown,
) {
  await rateLimit(`companion-draft:${user.id}`, 20);
  if (!id) {
    const data = draftSchema.parse(body);
    await authorize(
      user,
      patientId,
      data.kind === 'JOURNAL' ? 'journal.write' : 'appointments.manage',
    );
    return db.companionDraft.create({
      data: {
        patientId,
        userId: user.id,
        kind: data.kind,
        payload: data.payload as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + 30 * 60000),
      },
    });
  }
  z.object({ confirmed: z.literal(true) }).parse(body);
  return db.$transaction(async (tx) => {
    const draft = await tx.companionDraft.findFirst({
      where: { id, patientId, userId: user.id, committedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!draft) throw new ApiError(409, 'conflict');
    await authorize(
      user,
      patientId,
      draft.kind === 'JOURNAL' ? 'journal.write' : 'appointments.manage',
      tx,
    );
    const consumed = await tx.companionDraft.updateMany({
      where: { id, committedAt: null },
      data: { committedAt: new Date() },
    });
    if (!consumed.count) throw new ApiError(409, 'conflict');
    if (draft.kind === 'JOURNAL') {
      const payload = journalSchema.parse(draft.payload);
      const journal = await tx.journalEntry.create({
        data: { ...payload, patientId, actorId: user.id },
      });
      await audit(patientId, user, 'journalCreated', journal.id, tx);
      return { id: journal.id, message: 'saved' };
    }
    const payload = appointmentSchema.parse(draft.payload);
    const appointment = await tx.appointment.create({
      data: { ...payload, startsAt: new Date(payload.startsAt), patientId },
    });
    await audit(patientId, user, 'appointmentCreated', appointment.id, tx);
    await queueCareUpdate(
      tx,
      patientId,
      'appointmentUpdated',
      `appointment:${appointment.id}:created`,
    );
    return { id: appointment.id, message: 'saved' };
  });
}
