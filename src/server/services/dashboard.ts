import { DateTime } from 'luxon';
import type { User } from '@prisma/client';
import { db } from '../db';
import { authorize } from '../auth';
import { remainingStock, adherence } from '@/lib/schedule';
export async function dashboard(user: User, patientId: string) {
  const member = await authorize(user, patientId, 'profile.view');
  const keys = member.permissions.map((p) => p.key);
  const patient = member.circle.patient;
  const day = DateTime.now().setZone(patient.timezone).startOf('day');
  const [
    medications,
    doses,
    appointments,
    tasks,
    alerts,
    journal,
    members,
    activity,
    recent,
    vitals,
  ] = await Promise.all([
    keys.includes('medications.view')
      ? db.medication.findMany({
          where: { patientId },
          include: {
            schedule: true,
            refills: true,
            _count: { select: { doses: { where: { status: 'TAKEN' } } } },
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
      : [],
    keys.includes('medications.view')
      ? db.scheduledDose.findMany({
          where: {
            patientId,
            scheduledAt: { gte: day.toJSDate(), lt: day.plus({ days: 1 }).toJSDate() },
          },
          include: {
            medication: {
              select: { name: true, strength: true, dosage: true, instructions: true },
            },
          },
          orderBy: { scheduledAt: 'asc' },
          take: 100,
        })
      : [],
    keys.includes('appointments.manage')
      ? db.appointment.findMany({ where: { patientId }, orderBy: { startsAt: 'asc' }, take: 50 })
      : [],
    keys.includes('tasks.manage')
      ? db.careTask.findMany({ where: { patientId }, orderBy: { dueAt: 'asc' }, take: 50 })
      : [],
    keys.includes('medications.view')
      ? db.careAlert.findMany({
          where: { patientId, resolvedAt: null },
          include: { dose: { include: { medication: { select: { name: true } } } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
      : [],
    keys.includes('journal.view')
      ? db.journalEntry.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' }, take: 30 })
      : [],
    db.membership.findMany({
      where: { circleId: member.circleId, revokedAt: null },
      select: {
        id: true,
        role: true,
        relationship: true,
        user: { select: { id: true, name: true, language: true } },
        permissions: { select: { key: true } },
      },
    }),
    keys.includes('audit.view')
      ? db.auditLog.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' }, take: 10 })
      : [],
    keys.includes('medications.view')
      ? db.scheduledDose.findMany({
          where: {
            patientId,
            scheduledAt: { gte: day.minus({ days: 6 }).toJSDate(), lte: new Date() },
          },
          select: { status: true, scheduledAt: true, confirmedAt: true },
          orderBy: { scheduledAt: 'asc' },
          take: 1000,
        })
      : [],
    keys.includes('journal.view')
      ? db.vital.findMany({ where: { patientId }, orderBy: { recordedAt: 'desc' }, take: 30 })
      : [],
  ]);
  return {
    serverNow: new Date(),
    patient: {
      id: patient.id,
      name: patient.name,
      timezone: patient.timezone,
      demo: patient.demo,
      followupMinutes: patient.followupMinutes,
      escalateMinutes: patient.escalateMinutes,
    },
    role: member.role,
    permissions: keys,
    medications: medications.map((m) => ({
      ...m,
      estimatedStock: remainingStock(
        m.initialStock,
        m.refills.map((r) => r.quantity),
        m._count.doses,
        m.unitsPerDose,
      ),
    })),
    doses,
    appointments,
    tasks,
    alerts,
    journal,
    members,
    activity,
    vitals,
    adherence: adherence(recent),
    trend: Array.from({ length: 7 }, (_, i) => {
      const date = day.minus({ days: 6 - i });
      const events = recent.filter(
        (e) =>
          DateTime.fromJSDate(e.scheduledAt).setZone(patient.timezone).toISODate() ===
          date.toISODate(),
      );
      return { date: date.toISODate()!, ...adherence(events) };
    }),
  };
}
export type DashboardData = Awaited<ReturnType<typeof dashboard>>;
