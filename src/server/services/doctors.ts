import { z } from 'zod';
import type { User } from '@prisma/client';
import { db } from '../db';
import { ApiError } from '../errors';
import { reauthenticate } from './security';
export function isOperator(user: User) {
  const allowed = (process.env.OPERATOR_EMAILS || '')
    .toLowerCase()
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  return Boolean(
    !user.demo &&
    user.email &&
    user.emailVerifiedAt &&
    user.mfaEnabledAt &&
    allowed.includes(user.email.toLowerCase()),
  );
}
const profileSchema = z.object({
  registrationNumber: z.string().trim().min(3).max(100),
  specialty: z.string().trim().min(2).max(200),
  hospital: z.string().trim().min(2).max(200),
  contact: z.string().trim().max(100),
  location: z.string().trim().max(300),
  consultationHours: z.string().trim().max(300),
});
export async function doctorProfile(user: User, body?: unknown) {
  if (body === undefined)
    return {
      profile: await db.doctor.findUnique({ where: { userId: user.id } }),
      isOperator: isOperator(user),
    };
  if (user.demo) throw new ApiError(403, 'forbidden');
  const data = profileSchema.parse(body);
  return db.doctor.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: { ...data, verifiedAt: null, verifiedBy: null, verificationNote: null },
  });
}
export async function doctorReview(user: User, id?: string, body?: unknown) {
  if (!isOperator(user)) throw new ApiError(403, 'forbidden');
  if (body === undefined)
    return db.doctor.findMany({
      where: { user: { demo: false } },
      include: { user: { select: { name: true, email: true, emailVerifiedAt: true } } },
      orderBy: { id: 'desc' },
      take: 100,
    });
  const data = z
    .object({ approved: z.boolean(), verificationNote: z.string().trim().min(20).max(2000) })
    .parse(body);
  await reauthenticate(user, body);
  const doctor = await db.doctor.findFirst({
    where: { id, user: { demo: false, emailVerifiedAt: { not: null } } },
  });
  if (!doctor) throw new ApiError(400, 'verifyEmailFirst');
  if (doctor.userId === user.id) throw new ApiError(403, 'noSelfVerification');
  return db.doctor.update({
    where: { id },
    data: {
      verifiedAt: data.approved ? new Date() : null,
      verifiedBy: user.id,
      verificationNote: data.verificationNote,
    },
  });
}
