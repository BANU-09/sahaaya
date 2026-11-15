import { z } from 'zod';
import type { User, Prisma } from '@prisma/client';
import { db } from '../db';
import { authorize, audit } from '../auth';
import { ApiError } from '../errors';
import { queueCareUpdate } from './outbox';

const handoverPermissions = ['tasks.manage', 'medications.view', 'journal.view'] as const;
async function handoverAccess(user: User, patientId: string, tx: Prisma.TransactionClient = db) {
  for (const key of handoverPermissions) await authorize(user, patientId, key, tx);
}
export async function handovers(
  user: User,
  patientId: string,
  method: string,
  id: string | undefined,
  body: unknown,
) {
  await handoverAccess(user, patientId);
  if (method === 'GET') {
    const member = await authorize(user, patientId, 'tasks.manage');
    const items = await db.careHandover.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return items.map((item) => ({
      ...item,
      snapshot: {
        ...(item.snapshot as Prisma.JsonObject),
        ...(!member.permissions.some((p) => p.key === 'appointments.manage')
          ? { appointments: [] }
          : {}),
      },
    }));
  }
  if (method === 'PATCH' && id) {
    z.object({ acknowledged: z.literal(true) }).parse(body);
    const changed = await db.careHandover.updateMany({
      where: { id, patientId, recipientId: user.id, acknowledgedAt: null },
      data: { acknowledgedAt: new Date() },
    });
    if (!changed.count) throw new ApiError(409, 'conflict');
    await audit(patientId, user, 'handoverAcknowledged', id);
    return { message: 'saved' };
  }
  if (method !== 'POST') throw new ApiError(404, 'notFound');
  const data = z
    .object({
      recipientId: z.string(),
      observations: z.string().trim().max(3000),
      responsibilities: z.string().trim().min(1).max(3000),
    })
    .parse(body);
  return db.$transaction(async (tx) => {
    await handoverAccess(user, patientId, tx);
    const recipient = await tx.user.findUnique({ where: { id: data.recipientId } });
    if (!recipient || recipient.id === user.id) throw new ApiError(400, 'invalidInput');
    await handoverAccess(recipient, patientId, tx);
    const senderMember = await authorize(user, patientId, 'tasks.manage', tx),
      recipientMember = await authorize(recipient, patientId, 'tasks.manage', tx);
    const includeAppointments = [senderMember, recipientMember].every((m) =>
      m.permissions.some((p) => p.key === 'appointments.manage'),
    );
    const since = new Date(Date.now() - 24 * 3600000),
      until = new Date(Date.now() + 24 * 3600000);
    const [doses, tasks, appointments] = await Promise.all([
      tx.scheduledDose.findMany({
        where: { patientId, scheduledAt: { gte: since, lte: until } },
        select: {
          id: true,
          scheduledAt: true,
          status: true,
          confirmedAt: true,
          medication: { select: { name: true, dosage: true } },
        },
        orderBy: { scheduledAt: 'asc' },
        take: 500,
      }),
      tx.careTask.findMany({
        where: { patientId, OR: [{ status: 'OPEN' }, { completedAt: { gte: since } }] },
        select: { id: true, title: true, status: true, dueAt: true, assignedTo: true },
        take: 100,
      }),
      includeAppointments
        ? tx.appointment.findMany({
            where: {
              patientId,
              startsAt: { gte: new Date(), lte: new Date(Date.now() + 7 * 86400000) },
              status: { in: ['REQUESTED', 'CONFIRMED'] },
            },
            select: { id: true, doctor: true, startsAt: true, status: true, preparation: true },
            take: 50,
          })
        : [],
    ]);
    const snapshot = JSON.parse(
      JSON.stringify({ capturedAt: new Date(), doses, tasks, appointments }),
    ) as Prisma.InputJsonValue;
    const handover = await tx.careHandover.create({
      data: { patientId, senderId: user.id, ...data, snapshot },
    });
    await audit(patientId, user, 'handoverCreated', handover.id, tx);
    await queueCareUpdate(tx, patientId, 'taskCreated', `handover:${handover.id}`);
    return handover;
  });
}

const metadata = z.object({
  title: z.string().trim().min(1).max(150),
  category: z.enum([
    'prescription',
    'report',
    'scan',
    'discharge',
    'consultation',
    'insurance',
    'other',
  ]),
  notes: z.string().max(1000).nullable(),
  version: z.number().int().positive(),
});
export async function documentHistory(user: User, patientId: string, id: string, body?: unknown) {
  await authorize(user, patientId, 'records.view');
  if (body === undefined) {
    const document = await db.document.findFirst({
      where: { id, patientId },
      select: {
        id: true,
        title: true,
        category: true,
        notes: true,
        version: true,
        revisions: { orderBy: { version: 'desc' }, take: 100 },
        extractions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!document) throw new ApiError(404, 'notFound');
    return document;
  }
  const data = metadata.parse(body);
  return db.$transaction(async (tx) => {
    await authorize(user, patientId, 'records.upload', tx);
    const document = await tx.document.findFirst({
      where: { id, patientId, version: data.version },
    });
    if (!document) throw new ApiError(409, 'conflict');
    const changed = await tx.document.updateMany({
      where: { id, patientId, version: data.version },
      data: {
        title: data.title,
        category: data.category,
        notes: data.notes,
        version: { increment: 1 },
      },
    });
    if (!changed.count) throw new ApiError(409, 'conflict');
    await tx.documentRevision.create({
      data: {
        documentId: id,
        version: document.version,
        title: document.title,
        category: document.category,
        notes: document.notes,
        actorId: user.id,
      },
    });
    await audit(patientId, user, 'documentUpdated', id, tx);
    return { message: 'saved' };
  });
}
