import type { User } from '@prisma/client';
import { z } from 'zod';
import { db } from '../db';
import { authorize, audit } from '../auth';
import { ApiError, readJson } from '../errors';
import { journalSchema, taskSchema } from '@/lib/validation';
import { queueCareUpdate } from './outbox';
export async function createJournal(user: User, patientId: string, request: Request) {
  await authorize(user, patientId, 'journal.write');
  const data = journalSchema.parse(await readJson(request));
  const item = await db.journalEntry.create({ data: { ...data, patientId, actorId: user.id } });
  await audit(patientId, user, 'journalCreated', item.id);
  return item;
}
export async function createVital(user: User, patientId: string, request: Request) {
  await authorize(user, patientId, 'journal.write');
  const data = z
    .object({
      kind: z.enum(['BLOOD_PRESSURE', 'PULSE', 'WEIGHT', 'GLUCOSE']),
      value: z.number().positive().max(1000),
      secondaryValue: z.number().positive().max(300).optional(),
    })
    .parse(await readJson(request));
  const units = { BLOOD_PRESSURE: 'mmHg', PULSE: 'bpm', WEIGHT: 'kg', GLUCOSE: 'mg/dL' };
  const item = await db.vital.create({
    data: { ...data, unit: units[data.kind], patientId, actorId: user.id },
  });
  await audit(patientId, user, 'vitalCreated', item.id);
  return item;
}
export async function careTasks(user: User, patientId: string, id: string, request: Request) {
  const method = request.method;
  await authorize(user, patientId, 'tasks.manage');
  if (method === 'POST') {
    const data = taskSchema.parse(await readJson(request));
    if (
      data.assignedTo &&
      !(await db.membership.findFirst({
        where: { userId: data.assignedTo, circle: { patientId }, revokedAt: null },
      }))
    )
      throw new ApiError(403, 'forbidden');
    const task = await db.careTask.create({
      data: { ...data, patientId, dueAt: new Date(data.dueAt), createdBy: user.id },
    });
    await audit(patientId, user, 'taskCreated', task.id);
    await queueCareUpdate(
      db,
      patientId,
      'taskAssigned',
      `task:${task.id}`,
      false,
      task.assignedTo || undefined,
    );
    return task;
  }
  if (method === 'PATCH') {
    const data = z
      .object({
        status: z.enum(['OPEN', 'COMPLETED']),
        note: z.string().max(2000).optional(),
        assignedTo: z.string().optional(),
      })
      .parse(await readJson(request));
    if (
      data.assignedTo &&
      !(await db.membership.findFirst({
        where: { userId: data.assignedTo, circle: { patientId }, revokedAt: null },
      }))
    )
      throw new ApiError(403, 'forbidden');
    const changed = await db.careTask.updateMany({
      where: { id, patientId },
      data: {
        ...data,
        completedBy: data.status === 'COMPLETED' ? user.id : null,
        completedAt: data.status === 'COMPLETED' ? new Date() : null,
      },
    });
    if (!changed.count) throw new ApiError(404, 'notFound');
    await audit(patientId, user, 'taskCompleted', id);
    return { message: 'saved' };
  }
  throw new ApiError(404, 'notFound');
}
export async function updateAlert(user: User, patientId: string, id: string, request: Request) {
  await authorize(user, patientId, 'tasks.manage');
  const data = z
    .object({ action: z.enum(['ACKNOWLEDGE', 'RESOLVE']), followup: z.string().min(3).max(2000) })
    .parse(await readJson(request));
  const changed = await db.careAlert.updateMany({
    where: { id, patientId, resolvedAt: null },
    data: {
      followup: data.followup,
      ...(data.action === 'ACKNOWLEDGE'
        ? { acknowledgedBy: user.id, acknowledgedAt: new Date() }
        : { resolvedAt: new Date() }),
    },
  });
  if (!changed.count) throw new ApiError(409, 'conflict');
  await audit(
    patientId,
    user,
    data.action === 'ACKNOWLEDGE' ? 'alertAcknowledged' : 'alertResolved',
    id,
  );
  return { message: 'saved' };
}
