import { queueCareUpdate as queue, notificationPermission } from './outbox';
import { DateTime } from 'luxon';
import { db } from '../db';
import { generateDoses } from './scheduling';
import { careStage, isQuietHour, remainingStock, estimatedDaysOfSupply } from '@/lib/schedule';
import { getText } from '@/lib/i18n';
import { sendEmail, sendPush } from '../integrations/notifications';
import { ApiError } from '../errors';
export async function runScheduler(now = new Date()) {
  return db.$transaction(
    async (tx) => {
      // One scheduler across all dynos. The lock releases automatically with the transaction.
      const [lock] = await tx.$queryRaw<
        { locked: boolean }[]
      >`SELECT pg_try_advisory_xact_lock(7319281) AS locked`;
      if (!lock.locked) return { skipped: true };
      let medicationCursor: string | undefined;
      while (true) {
        const active = await tx.medication.findMany({
          where: { status: 'ACTIVE' },
          include: {
            schedule: true,
            refills: true,
            _count: { select: { doses: { where: { status: 'TAKEN' } } } },
          },
          take: 200,
          orderBy: { id: 'asc' },
          ...(medicationCursor ? { cursor: { id: medicationCursor }, skip: 1 } : {}),
        });
        for (const medication of active) {
          await generateDoses(medication.id, tx, now);
          const stock = remainingStock(
            medication.initialStock,
            medication.refills.map((refill) => refill.quantity),
            medication._count.doses,
            medication.unitsPerDose,
          );
          const days = medication.schedule
            ? estimatedDaysOfSupply(medication.schedule, stock, medication.unitsPerDose)
            : null;
          if (days !== null && days <= 7)
            await queue(
              tx,
              medication.patientId,
              'refill',
              `refill:${medication.id}:${now.toISOString().slice(0, 10)}`,
            );
          if (
            medication.expiryDate &&
            medication.expiryDate.getTime() < now.getTime() + 30 * 86400000
          )
            await queue(
              tx,
              medication.patientId,
              'expiryDate',
              `expiry:${medication.id}:${now.toISOString().slice(0, 10)}`,
            );
        }
        if (active.length < 200) break;
        medicationCursor = active.at(-1)!.id;
      }
      let doseCursor: string | undefined;
      let doseCount = 0;
      while (true) {
        const doses = await tx.scheduledDose.findMany({
          where: {
            status: { in: ['PENDING', 'SNOOZED', 'HELP'] },
            scheduledAt: { lte: now, gte: new Date(now.getTime() - 7 * 86400_000) },
            medication: { status: 'ACTIVE' },
          },
          include: { patient: true },
          take: 200,
          orderBy: { id: 'asc' },
          ...(doseCursor ? { cursor: { id: doseCursor }, skip: 1 } : {}),
        });
        for (const dose of doses) {
          const stage =
            dose.status === 'HELP'
              ? 'ESCALATED'
              : careStage(
                  dose.scheduledAt,
                  now,
                  dose.patient.followupMinutes,
                  dose.patient.escalateMinutes,
                  dose.snoozedUntil,
                );
          if (!stage) continue;
          const existing = await tx.careAlert.findUnique({ where: { doseId: dose.id } });
          if (existing?.resolvedAt) continue;
          await tx.careAlert.upsert({
            where: { doseId: dose.id },
            create: { doseId: dose.id, patientId: dose.patientId, stage },
            update: { stage },
          });
          await queue(tx, dose.patientId, stage, `${dose.id}:${stage}`, stage === 'ESCALATED');
        }
        doseCount += doses.length;
        if (doses.length < 200) break;
        doseCursor = doses.at(-1)!.id;
      }
      let appointmentCursor: string | undefined;
      let appointmentCount = 0;
      while (true) {
        const appointments = await tx.appointment.findMany({
          where: {
            status: { in: ['REQUESTED', 'CONFIRMED'] },
            startsAt: { gt: now, lte: new Date(now.getTime() + 86400_000) },
          },
          take: 200,
          orderBy: { id: 'asc' },
          ...(appointmentCursor ? { cursor: { id: appointmentCursor }, skip: 1 } : {}),
        });
        for (const appointment of appointments)
          await queue(
            tx,
            appointment.patientId,
            'appointments',
            `${appointment.id}:${appointment.startsAt.toISOString()}:reminder`,
          );
        appointmentCount += appointments.length;
        if (appointments.length < 200) break;
        appointmentCursor = appointments.at(-1)!.id;
      }
      await tx.workerHeartbeat.upsert({
        where: { id: 'scheduler' },
        create: { id: 'scheduler', lastRunAt: now },
        update: { lastRunAt: now, lastError: null },
      });
      await tx.rateBucket.deleteMany({
        where: { resetsAt: { lt: new Date(now.getTime() - 86400_000) } },
      });
      return { skipped: false, doses: doseCount, appointments: appointmentCount };
    },
    { timeout: 60_000 },
  );
}
export async function dispatchNotifications() {
  const jobs = await db.notification.findMany({
    where: { status: { in: ['QUEUED', 'RETRY'] }, dueAt: { lte: new Date() }, attempts: { lt: 5 } },
    include: { user: { include: { preferences: true, subscriptions: true } } },
    take: 50,
  });
  for (const job of jobs) {
    const preference = job.user.preferences;
    if (
      job.user.demo ||
      (job.channel === 'EMAIL' && (!preference?.email || !job.user.emailVerifiedAt)) ||
      (job.channel === 'PUSH' && !preference?.push)
    ) {
      await db.notification.update({
        where: { id: job.id },
        data: {
          status: 'SKIPPED',
          errorCode: job.user.demo ? 'DEMO_NO_EXTERNAL_DELIVERY' : 'PREFERENCE_DISABLED',
        },
      });
      continue;
    }
    const member = job.patientId
      ? await db.membership.findFirst({
          where: {
            userId: job.userId,
            circle: { patientId: job.patientId },
            revokedAt: null,
            permissions: {
              some: {
                key: notificationPermission(job.key),
              },
            },
          },
        })
      : null;
    if (job.patientId && !member) {
      await db.notification.update({
        where: { id: job.id },
        data: { status: 'SKIPPED', errorCode: 'ACCESS_REVOKED' },
      });
      continue;
    }
    if (
      preference &&
      isQuietHour(new Date(), job.user.timezone, preference.quietStart, preference.quietEnd)
    ) {
      const now = DateTime.now().setZone(job.user.timezone);
      let next = now.set({ hour: preference.quietEnd, minute: 0, second: 0 });
      if (next <= now) next = next.plus({ days: 1 });
      await db.notification.update({ where: { id: job.id }, data: { dueAt: next.toJSDate() } });
      continue;
    }
    const claimed = await db.notification.updateMany({
      where: { id: job.id, status: job.status, attempts: job.attempts },
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
        dueAt: new Date(Date.now() + 5 * 60_000),
      },
    });
    if (!claimed.count) continue;
    try {
      const content = getText(job.user.language, 'careReminder');
      let providerId = '';
      if (job.channel === 'EMAIL' && job.user.email)
        providerId = await sendEmail(job.user.email, 'Sahaaya', content, job.eventKey);
      else if (job.channel === 'PUSH' && job.user.subscriptions.length) {
        const ids = [];
        for (const sub of job.user.subscriptions) {
          try {
            ids.push(await sendPush(sub.token, 'Sahaaya', content, job.id));
          } catch (error) {
            if (error instanceof ApiError && error.code === 'pushExpired') {
              await db.pushSubscription.deleteMany({ where: { id: sub.id, userId: job.userId } });
            } else throw error;
          }
        }
        if (!ids.length) throw new ApiError(410, 'pushExpired');
        providerId = ids.join(',');
      } else throw new ApiError(503, 'notConfigured');
      // Provider acceptance is not proof of delivery to a device or inbox.
      await db.notification.update({
        where: { id: job.id },
        data: { acceptedAt: new Date(), providerId },
      });
      await db.notification.updateMany({
        where: { id: job.id, status: 'PROCESSING' },
        data: { status: 'ACCEPTED', errorCode: null },
      });
    } catch (error) {
      await db.notification.updateMany({
        where: { id: job.id, status: 'PROCESSING' },
        data: {
          status: job.attempts >= 4 ? 'FAILED' : 'RETRY',
          dueAt: new Date(Date.now() + Math.pow(2, job.attempts) * 60_000),
          errorCode: error instanceof ApiError ? error.code : 'providerError',
        },
      });
    }
  }
  await db.notification.updateMany({
    where: { status: 'PROCESSING', dueAt: { lt: new Date() } },
    data: { status: 'RETRY' },
  });
}
