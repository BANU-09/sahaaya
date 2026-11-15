import { cookies } from 'next/headers';
import { z } from 'zod';
import { db } from '../db';
import { ApiError, readJson } from '../errors';
import { registrationSchema, loginSchema, password } from '@/lib/validation';
import { PERMISSIONS } from '@/lib/permissions';
import { hashSecret, verifySecret, token, digest } from '../crypto';
import { createSession, publicUser, rateLimit, SESSION_COOKIE, authenticate } from '../auth';
import { DEMO_USERS, seedDemo } from './demo';
import { sendEmail } from '../integrations/notifications';
import { emailConfigured } from '../integrations/email';
import { beginSignIn, finishSignIn } from './security';
export async function authAction(action: string, request: Request) {
  const body = await readJson(request);
  if (action === 'mfa') return finishSignIn(body, request);
  if (action === 'register') {
    const data = registrationSchema.parse(body);
    await rateLimit(`register:${data.email || data.mobile}`, 5, 3600_000);
    const passwordHash = await hashSecret(data.password);
    const pinHash = data.pin ? await hashSecret(data.pin) : undefined;
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          mobile: data.mobile,
          passwordHash,
          pinHash,
          language: data.language,
          timezone: data.timezone,
          easyMode: data.easyMode,
          preferences: { create: {} },
          ...(data.role === 'CAREGIVER' ? { caregiver: { create: {} } } : {}),
        },
      });
      if (data.role === 'PATIENT') {
        const patient = await tx.patient.create({
          data: {
            ownerId: created.id,
            name: created.name,
            dob: data.dob ? new Date(data.dob) : null,
            timezone: data.timezone,
            allergies: [],
            conditions: [],
            emergencyName: data.emergencyName,
            emergencyPhone: data.emergencyPhone,
            circle: { create: {} },
          },
          include: { circle: true },
        });
        await tx.membership.create({
          data: {
            circleId: patient.circle!.id,
            userId: created.id,
            role: 'PATIENT',
            relationship: 'Self',
            consentedAt: new Date(),
            permissions: { create: PERMISSIONS.map((key) => ({ key })) },
          },
        });
      }
      return created;
    });
    await createSession(user.id, request);
    return publicUser(user);
  }
  if (action === 'login') {
    const data = loginSchema.parse(body);
    const identity = data.identity.toLowerCase();
    await rateLimit(`login:${identity}`, 8, 15 * 60000);
    const user = await db.user.findFirst({
      where: { OR: [{ email: identity }, { mobile: identity }], demo: false },
    });
    if (!(await verifySecret(data.password, user?.passwordHash || null)) || !user)
      throw new ApiError(401, 'invalidCredentials');
    return beginSignIn(user, request);
  }
  if (action === 'demo') {
    if (process.env.DEMO_MODE !== 'true') throw new ApiError(404, 'notFound');
    const { role, language } = z
      .object({
        role: z.enum(['PATIENT', 'FAMILY', 'CAREGIVER', 'DOCTOR']),
        language: z.enum(['en', 'te', 'ta', 'hi', 'kn', 'ml']).default('en'),
      })
      .parse(body);
    await seedDemo();
    const user = await db.user.update({ where: { id: DEMO_USERS[role] }, data: { language } });
    await createSession(user.id, request);
    return publicUser(user);
  }
  if (action === 'recover') {
    const { email } = z.object({ email: z.email().toLowerCase() }).parse(body);
    await rateLimit(`recover:${email}`, 3, 3600_000);
    if (!emailConfigured()) throw new ApiError(503, 'notConfigured');
    const user = await db.user.findFirst({ where: { email, demo: false } });
    if (user) {
      const value = token();
      await db.recoveryToken.create({
        data: {
          userId: user.id,
          tokenHash: digest(value),
          expiresAt: new Date(Date.now() + 30 * 60000),
        },
      });
      await sendEmail(
        email,
        'Sahaaya account recovery',
        `${process.env.APP_URL}/reset?token=${value}`,
        digest(value),
      );
    }
    return { message: 'recoverySent' };
  }
  if (action === 'reset') {
    const data = z.object({ token: z.string().min(30).max(100), password }).parse(body);
    const passwordHash = await hashSecret(data.password);
    await db.$transaction(async (tx) => {
      const reset = await tx.recoveryToken.findUnique({ where: { tokenHash: digest(data.token) } });
      if (!reset || reset.usedAt || reset.expiresAt < new Date())
        throw new ApiError(403, 'forbidden');
      const changed = await tx.recoveryToken.updateMany({
        where: { id: reset.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (!changed.count) throw new ApiError(409, 'conflict');
      await tx.user.update({ where: { id: reset.userId }, data: { passwordHash } });
      await tx.session.deleteMany({ where: { userId: reset.userId } });
    });
    return { message: 'saved' };
  }
  if (action === 'logout') {
    const { session } = await authenticate(true);
    await db.session.delete({ where: { id: session.id } });
    (await cookies()).delete(SESSION_COOKIE);
    return { message: 'saved' };
  }
  if (action === 'unlock') {
    const { user, session } = await authenticate(true);
    const { pin } = z.object({ pin: z.string().regex(/^\d{6}$/) }).parse(body);
    await rateLimit(`pin:${session.id}`, 5, 15 * 60000);
    if (!(await verifySecret(pin, user.pinHash))) throw new ApiError(401, 'invalidCredentials');
    await db.session.update({
      where: { id: session.id },
      data: { unlockedUntil: session.expiresAt },
    });
    return { message: 'saved' };
  }
  if (action === 'lock') {
    const { user, session } = await authenticate();
    if (!user.pinHash) throw new ApiError(400, 'invalidInput');
    await db.session.update({ where: { id: session.id }, data: { unlockedUntil: new Date(0) } });
    return { message: 'saved' };
  }
  throw new ApiError(404, 'notFound');
}
