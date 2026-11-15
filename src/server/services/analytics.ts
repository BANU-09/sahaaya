import { DateTime } from 'luxon';
import { z } from 'zod';
import type { User } from '@prisma/client';
import { authorize } from '../auth';
import { db } from '../db';
import { ApiError } from '../errors';
import { adherence } from '@/lib/schedule';
import { dailyAdherence } from '@/lib/analytics';
export async function careAnalytics(user: User, patientId: string, url: URL) {
  const member = await authorize(user, patientId, 'medications.view');
  const zone = member.circle.patient.timezone,
    now = DateTime.now().setZone(zone);
  const requested = z.coerce
    .number()
    .int()
    .min(1)
    .max(366)
    .parse(url.searchParams.get('days') || 7);
  const from = url.searchParams.get('from'),
    to = url.searchParams.get('to');
  if (Boolean(from) !== Boolean(to)) throw new ApiError(400, 'invalidInput');
  const start = from
    ? DateTime.fromISO(z.iso.date().parse(from), { zone }).startOf('day')
    : now.startOf('day').minus({ days: requested - 1 });
  const last = to
    ? DateTime.fromISO(z.iso.date().parse(to), { zone }).startOf('day')
    : now.startOf('day');
  const days = Math.round(last.diff(start, 'days').days) + 1;
  if (!start.isValid || !last.isValid || days < 1 || days > 366 || last > now)
    throw new ApiError(400, 'invalidInput');
  const end = DateTime.min(last.endOf('day'), now);
  const [events, vitals, refills] = await Promise.all([
    db.scheduledDose.findMany({
      where: { patientId, scheduledAt: { gte: start.toJSDate(), lte: end.toJSDate() } },
      select: { status: true, scheduledAt: true, confirmedAt: true },
      orderBy: { scheduledAt: 'asc' },
      take: 10001,
    }),
    member.permissions.some((p) => p.key === 'journal.view')
      ? db.vital.findMany({
          where: { patientId, recordedAt: { gte: start.toJSDate(), lte: end.toJSDate() } },
          orderBy: { recordedAt: 'asc' },
          take: 2001,
        })
      : [],
    db.refill.findMany({
      where: {
        medication: { patientId },
        createdAt: { gte: start.toJSDate(), lte: end.toJSDate() },
      },
      select: { id: true, quantity: true, createdAt: true, medication: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
      take: 1001,
    }),
  ]);
  if (events.length > 10000 || vitals.length > 2000 || refills.length > 1000)
    throw new ApiError(413, 'rangeTooLarge');
  const daily = dailyAdherence(events, start, days);
  const bucket = Math.max(1, Math.ceil(days / 10));
  const trend = Array.from({ length: Math.ceil(days / bucket) }, (_, i) => {
    const from = start.plus({ days: i * bucket }),
      to = from.plus({ days: bucket });
    return {
      date: from.toISODate(),
      ...adherence(
        events.filter((e) => e.scheduledAt >= from.toJSDate() && e.scheduledAt < to.toJSDate()),
      ),
    };
  });
  return {
    ...adherence(events),
    days,
    from: start.toISODate(),
    to: last.toISODate(),
    daily,
    trend,
    vitals,
    refills,
    delayed: events.filter(
      (e) =>
        e.status === 'TAKEN' &&
        e.confirmedAt &&
        e.confirmedAt.getTime() - e.scheduledAt.getTime() > 30 * 60000,
    ).length,
  };
}
