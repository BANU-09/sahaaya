import type { User } from '@prisma/client';
import { z } from 'zod';
import { db } from '../db';
import { audit, publicUser } from '../auth';
import { ApiError, readJson } from '../errors';
import { integrationStatus } from '../integrations/google';
import { hashSecret, verifySecret } from '../crypto';
import { languages, timezone } from '@/lib/validation';
import { PERMISSIONS } from '@/lib/permissions';
export async function onboardPatient(user: User, request: Request) {
  z.object({ consent: z.literal(true) }).parse(await readJson(request));
  if (user.demo) throw new ApiError(403, 'forbidden');
  return db.$transaction(async (tx) => {
    if (await tx.patient.findUnique({ where: { ownerId: user.id } }))
      throw new ApiError(409, 'conflict');
    const patient = await tx.patient.create({
      data: {
        ownerId: user.id,
        name: user.name,
        timezone: user.timezone,
        allergies: [],
        conditions: [],
        circle: {
          create: {
            members: {
              create: {
                userId: user.id,
                role: 'PATIENT',
                relationship: 'Self',
                consentedAt: new Date(),
                permissions: { create: PERMISSIONS.map((key) => ({ key })) },
              },
            },
          },
        },
      },
    });
    await audit(patient.id, user, 'profileUpdated', patient.id, tx);
    return { id: patient.id };
  });
}
export async function getMe(user: User) {
  const memberships = await db.membership.findMany({
    where: { userId: user.id, revokedAt: null, circle: { patient: { demo: user.demo } } },
    select: { role: true, circle: { select: { patient: { select: { id: true, name: true } } } } },
  });
  const doctorVerified =
    user.demo ||
    !memberships.some((m) => m.role === 'DOCTOR') ||
    Boolean(
      await db.doctor.findFirst({
        where: { userId: user.id, verifiedAt: { not: null } },
        select: { id: true },
      }),
    );
  return {
    user: publicUser(user),
    patients: memberships
      .filter((m) => m.role !== 'DOCTOR' || doctorVerified)
      .map((m) => ({ ...m.circle.patient, role: m.role })),
  };
}
export async function getSettings(user: User, sessionId: string) {
  return {
    user: publicUser(user),
    preferences: await db.notificationPreference.findUnique({ where: { userId: user.id } }),
    sessions: await db.session.findMany({
      where: { userId: user.id, expiresAt: { gt: new Date() } },
      select: { id: true, device: true, createdAt: true },
      take: 20,
    }),
    currentSession: sessionId,
    integrations: integrationStatus(),
    reminderCheckMinutes: Number(process.env.REMINDER_CHECK_MINUTES || 1),
    googleConnected: Boolean(
      await db.googleAccount.findFirst({
        where: { userId: user.id, encryptedRefreshToken: { not: null } },
      }),
    ),
  };
}
export async function updateSettings(user: User, request: Request) {
  const data = z
    .object({
      language: z.enum(languages).optional(),
      easyMode: z.boolean().optional(),
      timezone: timezone.optional(),
      pin: z
        .string()
        .regex(/^\d{6}$/)
        .optional(),
      currentPassword: z.string().max(128).optional(),
      email: z.boolean().optional(),
      push: z.boolean().optional(),
      quietStart: z.number().int().min(0).max(23).optional(),
      quietEnd: z.number().int().min(0).max(23).optional(),
    })
    .parse(await readJson(request));
  if (data.pin && !(await verifySecret(data.currentPassword || '', user.passwordHash)))
    throw new ApiError(403, 'invalidCredentials');
  const { language, easyMode, timezone: zone, pin, ...prefs } = data;
  delete prefs.currentPassword;
  const pinHash = pin ? await hashSecret(pin) : undefined;
  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: {
        language,
        easyMode,
        timezone: zone,
        ...(pinHash ? { pinHash } : {}),
      },
    }),
    db.notificationPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...prefs },
      update: prefs,
    }),
  ]);
  return { message: 'saved' };
}
