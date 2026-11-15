import { cookies } from 'next/headers';
import { Secret, TOTP } from 'otpauth';
import { randomBytes, randomInt } from 'node:crypto';
import { z } from 'zod';
import type { User, Prisma } from '@prisma/client';
import { db } from '../db';
import { ApiError } from '../errors';
import { createSession, publicUser, rateLimit } from '../auth';
import { decrypt, digest, encrypt, token, verifySecret } from '../crypto';
import { sendEmail } from '../integrations/notifications';

const PENDING = 'sahaaya_mfa';
const proofSchema = z.object({
  currentPassword: z.string().max(128).default(''),
  code: z.string().max(80).default(''),
});
const totp = (secret: string, label = 'SAHAAYA') =>
  new TOTP({
    issuer: 'SAHAAYA',
    label,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secret),
  });

// Consume the time step atomically; concurrent requests cannot reuse a code.
export async function consumeSecondFactor(
  user: User,
  code: string,
  tx: Prisma.TransactionClient = db,
) {
  if (!user.mfaEnabledAt || !user.mfaSecret) throw new ApiError(403, 'invalidCredentials');
  const authenticator = totp(decrypt(user.mfaSecret));
  const delta = /^\d{6}$/.test(code) ? authenticator.validate({ token: code, window: 1 }) : null;
  if (delta !== null) {
    const counter = authenticator.counter() + delta;
    const used = await tx.user.updateMany({
      where: { id: user.id, mfaCounter: { lt: counter }, mfaSecret: user.mfaSecret },
      data: { mfaCounter: counter },
    });
    if (used.count) return;
  } else {
    const used = await tx.mfaRecoveryCode.updateMany({
      where: {
        userId: user.id,
        codeHash: digest(code.toUpperCase().replaceAll('-', '')),
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });
    if (used.count) return;
  }
  throw new ApiError(403, 'invalidCredentials');
}

export async function reauthenticate(user: User, body: unknown) {
  await rateLimit(`reauth:${user.id}`, 8, 15 * 60000);
  const proof = proofSchema.parse(body);
  if (user.passwordHash) {
    if (!(await verifySecret(proof.currentPassword, user.passwordHash)))
      throw new ApiError(403, 'invalidCredentials');
    if (user.mfaEnabledAt) await consumeSecondFactor(user, proof.code);
  } else if (user.mfaEnabledAt) await consumeSecondFactor(user, proof.code);
  else await consumeIdentityCode(user, 'REAUTH', proof.code);
}

export async function beginSignIn(user: User, request: Request) {
  if (!user.mfaEnabledAt) {
    await createSession(user.id, request);
    return { ...publicUser(user), mfaRequired: false };
  }
  const value = token();
  await db.identityChallenge.create({
    data: {
      userId: user.id,
      kind: 'MFA_LOGIN',
      tokenHash: digest(value),
      expiresAt: new Date(Date.now() + 5 * 60000),
    },
  });
  (await cookies()).set(PENDING, value, {
    httpOnly: true,
    secure: process.env.APP_URL?.startsWith('https://'),
    sameSite: 'lax',
    path: '/',
    maxAge: 300,
  });
  return { mfaRequired: true };
}

export async function finishSignIn(body: unknown, request: Request) {
  const { code } = z.object({ code: z.string().min(6).max(80) }).parse(body);
  const pending = (await cookies()).get(PENDING)?.value;
  if (!pending) throw new ApiError(401, 'unauthenticated');
  const challenge = await db.identityChallenge.findUnique({
    where: { tokenHash: digest(pending) },
    include: { user: true },
  });
  if (
    !challenge ||
    challenge.kind !== 'MFA_LOGIN' ||
    challenge.usedAt ||
    challenge.expiresAt < new Date()
  )
    throw new ApiError(401, 'unauthenticated');
  await rateLimit(`mfa:${challenge.userId}`, 8, 15 * 60000);
  await db.$transaction(async (tx) => {
    const used = await tx.identityChallenge.updateMany({
      where: { id: challenge.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (!used.count) throw new ApiError(409, 'conflict');
    await consumeSecondFactor(challenge.user, code, tx);
  });
  (await cookies()).delete(PENDING);
  await createSession(challenge.userId, request);
  return publicUser(challenge.user);
}

async function consumeIdentityCode(user: User, kind: string, code: string) {
  const used = await db.identityChallenge.updateMany({
    where: {
      userId: user.id,
      kind,
      tokenHash: digest(`${user.id}:${kind}:${code}`),
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  });
  if (!used.count) throw new ApiError(403, 'invalidCredentials');
}

export async function securityAction(user: User, action: string, body: unknown, sessionId: string) {
  if (user.demo) throw new ApiError(403, 'forbidden');
  if (action === 'send-code') {
    const { purpose } = z.object({ purpose: z.enum(['VERIFY_EMAIL', 'REAUTH']) }).parse(body);
    if (!user.email || !process.env.RESEND_API_KEY) throw new ApiError(503, 'notConfigured');
    await rateLimit(`email-code:${user.id}`, 3, 15 * 60000);
    const code = String(randomInt(100000, 1000000));
    await db.identityChallenge.updateMany({
      where: { userId: user.id, kind: purpose, usedAt: null },
      data: { usedAt: new Date() },
    });
    const challenge = await db.identityChallenge.create({
      data: {
        userId: user.id,
        kind: purpose,
        tokenHash: digest(`${user.id}:${purpose}:${code}`),
        expiresAt: new Date(Date.now() + 10 * 60000),
      },
    });
    await sendEmail(
      user.email,
      'SAHAAYA account verification',
      `Your verification code is ${code}. It expires in 10 minutes. Do not share it.`,
      challenge.id,
    );
    return { message: 'verificationSent' };
  }
  if (action === 'verify-email') {
    await rateLimit(`verify-email:${user.id}`, 5, 15 * 60000);
    await consumeIdentityCode(
      user,
      'VERIFY_EMAIL',
      z.object({ code: z.string().regex(/^\d{6}$/) }).parse(body).code,
    );
    await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    return { message: 'saved' };
  }
  if (action === 'mfa-start') {
    await reauthenticate(user, body);
    if (user.mfaEnabledAt) throw new ApiError(409, 'conflict');
    const secret = new Secret({ size: 20 }).base32;
    await db.user.update({
      where: { id: user.id },
      data: { mfaSecret: encrypt(secret), mfaCounter: 0 },
    });
    return { secret, uri: totp(secret, user.email || user.name).toString() };
  }
  if (action === 'mfa-enable') {
    await rateLimit(`mfa-enroll:${user.id}`, 8, 15 * 60000);
    if (!user.mfaSecret || user.mfaEnabledAt) throw new ApiError(409, 'conflict');
    const code = z.object({ code: z.string().regex(/^\d{6}$/) }).parse(body).code;
    const authenticator = totp(decrypt(user.mfaSecret));
    const delta = authenticator.validate({ token: code, window: 1 });
    if (delta === null) throw new ApiError(403, 'invalidCredentials');
    const codes = Array.from({ length: 10 }, () => randomBytes(8).toString('hex').toUpperCase());
    await db.$transaction(async (tx) => {
      const enabled = await tx.user.updateMany({
        where: { id: user.id, mfaEnabledAt: null, mfaSecret: user.mfaSecret },
        data: { mfaEnabledAt: new Date(), mfaCounter: authenticator.counter() + delta },
      });
      if (!enabled.count) throw new ApiError(409, 'conflict');
      await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
      await tx.mfaRecoveryCode.createMany({
        data: codes.map((code) => ({ userId: user.id, codeHash: digest(code) })),
      });
      await tx.session.deleteMany({ where: { userId: user.id, id: { not: sessionId } } });
    });
    return { codes };
  }
  if (action === 'mfa-disable') {
    await reauthenticate(user, body);
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { mfaSecret: null, mfaEnabledAt: null, mfaCounter: 0 },
      });
      await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
      await tx.session.deleteMany({ where: { userId: user.id, id: { not: sessionId } } });
    });
    return { message: 'saved' };
  }
  throw new ApiError(404, 'notFound');
}
