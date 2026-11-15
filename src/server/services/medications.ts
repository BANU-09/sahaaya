import { queueCareUpdate } from './outbox';
import { generateDoses } from './scheduling';
import { db } from '../db';
import { authorize, audit } from '../auth';
import { ApiError } from '../errors';
import { medicationSchema, doseSchema } from '@/lib/validation';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { canTransition } from '@/lib/schedule';
import type { User } from '@prisma/client';
export async function editMedication(user: User, patientId: string, id: string, body: unknown) {
  const { schedule, expiryDate, ...data } = medicationSchema.parse(body);
  return db.$transaction(async (tx) => {
    await authorize(user, patientId, 'medications.edit', tx);
    if (
      data.prescriptionId &&
      !(await tx.prescription.findFirst({ where: { id: data.prescriptionId, patientId } }))
    )
      throw new ApiError(404, 'notFound');
    const changed = await tx.medication.updateMany({
      where: { id, patientId, status: 'DRAFT' },
      data: { ...data, expiryDate: expiryDate ? new Date(expiryDate) : null },
    });
    if (!changed.count) throw new ApiError(409, 'conflict');
    await tx.medicationSchedule.update({ where: { medicationId: id }, data: schedule });
    await audit(patientId, user, 'medicationDraftEdited', id, tx);
    return { id };
  });
}
export async function recordPrnDose(user: User, patientId: string, id: string, body: unknown) {
  const data = z
    .object({
      requestId: z.uuid(),
      verified: z.literal(true),
      witnessed: z.boolean().default(false),
      reason: z.string().max(500).optional(),
    })
    .parse(body);
  return db.$transaction(async (tx) => {
    const member = await authorize(user, patientId, 'doses.confirm', tx);
    if (member.role !== 'PATIENT' && !data.witnessed) throw new ApiError(400, 'witnessRequired');
    const med = await tx.medication.findFirst({
      where: { id, patientId, status: 'ACTIVE' },
      include: { schedule: true },
    });
    const day = DateTime.now()
      .setZone(med?.schedule?.timezone || 'UTC')
      .toISODate()!;
    if (
      !med?.schedule ||
      med.schedule.frequency !== 'PRN' ||
      day < med.schedule.startDate ||
      (med.schedule.endDate && day > med.schedule.endDate)
    )
      throw new ApiError(409, 'conflict');
    const doseId = `prn_${data.requestId}`;
    const existing = await tx.scheduledDose.findUnique({ where: { id: doseId } });
    if (existing) {
      if (existing.patientId !== patientId || existing.medicationId !== id)
        throw new ApiError(409, 'conflict');
      return { id: doseId, status: 'TAKEN' };
    }
    const now = new Date();
    await tx.scheduledDose.create({
      data: {
        id: doseId,
        medicationId: id,
        patientId,
        scheduledAt: now,
        confirmedAt: now,
        status: 'TAKEN',
        events: {
          create: {
            actorId: user.id,
            status: 'TAKEN',
            source: member.role === 'PATIENT' ? 'SELF' : 'WITNESSED',
            reason: data.reason,
          },
        },
      },
    });
    await audit(patientId, user, 'doseTAKEN', doseId, tx);
    return { id: doseId, status: 'TAKEN' };
  });
}
export async function createMedication(user: User, patientId: string, body: unknown) {
  const data = medicationSchema.parse(body);
  return db.$transaction(async (tx) => {
    await authorize(user, patientId, 'medications.edit', tx);
    if (
      data.prescriptionId &&
      !(await tx.prescription.findFirst({ where: { id: data.prescriptionId, patientId } }))
    )
      throw new ApiError(404, 'notFound');
    const { schedule, expiryDate, ...rest } = data;
    const result = await tx.medication.create({
      data: {
        ...rest,
        patientId,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        schedule: { create: schedule },
      },
      include: { schedule: true },
    });
    await audit(patientId, user, 'medicationDraftCreated', result.id, tx);
    await queueCareUpdate(tx, patientId, 'prescriptionReview', `review:${result.id}`);
    return result;
  });
}
export async function approveMedication(user: User, patientId: string, id: string) {
  return db.$transaction(async (tx) => {
    await authorize(user, patientId, 'prescriptions.approve', tx);
    const changed = await tx.medication.updateMany({
      where: { id, patientId, status: 'DRAFT' },
      data: { status: 'ACTIVE', approvedAt: new Date(), approvedBy: user.id },
    });
    if (!changed.count) throw new ApiError(409, 'conflict');
    await generateDoses(id, tx);
    const medication = await tx.medication.findUniqueOrThrow({ where: { id } });
    if (medication.prescriptionId)
      await tx.prescription.update({
        where: { id: medication.prescriptionId },
        data: { status: 'VERIFIED', verifiedBy: user.id, verifiedAt: new Date() },
      });
    await audit(patientId, user, 'medicationApproved', id, tx);
    return medication;
  });
}
export async function confirmDose(user: User, patientId: string, id: string, body: unknown) {
  const data = doseSchema.parse(body);
  return db.$transaction(async (tx) => {
    const member = await authorize(user, patientId, 'doses.confirm', tx);
    if (member.role !== 'PATIENT' && data.action === 'TAKEN' && !data.witnessed)
      throw new ApiError(400, 'witnessRequired');
    const dose = await tx.scheduledDose.findFirst({
      where: { id, patientId },
      include: { medication: true },
    });
    if (!dose) throw new ApiError(404, 'notFound');
    if (
      !canTransition(dose.status, data.action) ||
      dose.scheduledAt.getTime() > Date.now() + 3600_000 ||
      dose.medication.status !== 'ACTIVE'
    )
      throw new ApiError(409, 'conflict');
    const now = new Date();
    const changed = await tx.scheduledDose.updateMany({
      where: { id, version: dose.version },
      data: {
        status: data.action,
        version: { increment: 1 },
        confirmedAt: ['TAKEN', 'NOT_TAKEN'].includes(data.action) ? now : null,
        snoozedUntil: data.action === 'SNOOZED' ? new Date(now.getTime() + 600_000) : null,
      },
    });
    if (!changed.count) throw new ApiError(409, 'conflict');
    await tx.doseEvent.create({
      data: {
        doseId: id,
        actorId: user.id,
        status: data.action,
        source: member.role === 'PATIENT' ? 'SELF' : 'WITNESSED',
        reason: data.reason,
      },
    });
    if (['TAKEN', 'NOT_TAKEN'].includes(data.action))
      await tx.careAlert.updateMany({
        where: { doseId: id, resolvedAt: null },
        data: { resolvedAt: now, followup: data.reason || data.action },
      });
    if (data.action === 'HELP')
      await tx.careAlert.upsert({
        where: { doseId: id },
        create: { doseId: id, patientId, stage: 'ESCALATED' },
        update: { stage: 'ESCALATED' },
      });
    await audit(patientId, user, `dose${data.action}`, id, tx);
    return { status: data.action };
  });
}
