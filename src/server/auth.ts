import { cookies } from 'next/headers';
import { db } from './db';
import { ApiError } from './errors';
import { digest, token } from './crypto';
import { canAccess, type Permission } from '@/lib/permissions';
import type { Prisma, User } from '@prisma/client';
export const SESSION_COOKIE = 'sahaaya_session';
export const publicUser = (user: User) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  language: user.language,
  timezone: user.timezone,
  easyMode: user.easyMode,
  demo: user.demo,
  hasPin: Boolean(user.pinHash),
  emailVerified: Boolean(user.emailVerifiedAt),
  mobileVerified: Boolean(user.mobileVerifiedAt),
  mfaEnabled: Boolean(user.mfaEnabledAt),
});
export async function createSession(userId: string, request: Request) {
  const value = token();
  const expiresAt = new Date(Date.now() + 7 * 86400_000);
  await db.session.create({
    data: {
      tokenHash: digest(value),
      userId,
      expiresAt,
      unlockedUntil: expiresAt,
      device: request.headers.get('user-agent')?.slice(0, 120) || 'Browser',
    },
  });
  (await cookies()).set(SESSION_COOKIE, value, {
    httpOnly: true,
    secure: process.env.APP_URL?.startsWith('https://'),
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}
export async function authenticate(allowLocked = false) {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) throw new ApiError(401, 'unauthenticated');
  const session = await db.session.findUnique({
    where: { tokenHash: digest(value) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) throw new ApiError(401, 'unauthenticated');
  if (!allowLocked && session.unlockedUntil < new Date()) throw new ApiError(423, 'locked');
  return { user: session.user, session };
}
export async function authorize(
  user: User,
  patientId: string,
  permission: Permission,
  client: Prisma.TransactionClient = db,
) {
  const member = await client.membership.findFirst({
    where: {
      userId: user.id,
      circle: { patientId, patient: { demo: user.demo } },
      revokedAt: null,
    },
    include: { permissions: true, circle: { include: { patient: true } } },
  });
  if (
    !member ||
    !canAccess(
      member.permissions.map((p) => p.key),
      permission,
    )
  )
    throw new ApiError(403, 'forbidden');
  if (
    member.role === 'DOCTOR' &&
    !user.demo &&
    !(await client.doctor.findFirst({
      where: { userId: user.id, verifiedAt: { not: null } },
      select: { id: true },
    }))
  )
    throw new ApiError(403, 'doctorVerificationRequired');
  return member;
}
export async function audit(
  patientId: string,
  user: User,
  action: string,
  entityId?: string,
  client: Prisma.TransactionClient = db,
) {
  await client.auditLog.create({
    data: { patientId, actorId: user.id, actorName: user.name, action, entityId },
  });
}
export function checkOrigin(request: Request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  const expected = new URL(process.env.APP_URL || 'http://localhost:3100').origin;
  if (
    request.headers.get('origin') !== expected ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    throw new ApiError(403, 'forbidden');
}
export async function rateLimit(key: string, limit = 30, windowMs = 60_000) {
  const bucketKey = digest(key);
  const rows = await db.$queryRaw<
    { count: number }[]
  >`INSERT INTO "RateBucket" (key, count, "resetsAt") VALUES (${bucketKey}, 1, ${new Date(Date.now() + windowMs)}) ON CONFLICT (key) DO UPDATE SET count = CASE WHEN "RateBucket"."resetsAt" < NOW() THEN 1 ELSE "RateBucket".count + 1 END, "resetsAt" = CASE WHEN "RateBucket"."resetsAt" < NOW() THEN ${new Date(Date.now() + windowMs)} ELSE "RateBucket"."resetsAt" END RETURNING count`;
  if (rows[0].count > limit) throw new ApiError(429, 'rateLimited');
}
