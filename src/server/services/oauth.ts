import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { oauthClient } from '../integrations/google';
import { token, encrypt } from '../crypto';
import { authenticate } from '../auth';
import { beginSignIn } from './security';
import { db } from '../db';
import { ApiError } from '../errors';
const pendingSchema = z.object({
  state: z.string(),
  nonce: z.string(),
  verifier: z.string(),
  userId: z.string().nullable(),
  calendar: z.boolean(),
});
export async function googleStart(request: Request) {
  const calendar = new URL(request.url).searchParams.get('calendar') === 'true';
  const auth = await authenticate().catch(() => null);
  if (calendar && !auth) throw new ApiError(401, 'unauthenticated');
  if (auth?.user.demo) throw new ApiError(403, 'forbidden');
  const state = token(),
    nonce = token(),
    verifier = token();
  const client = oauthClient();
  (await cookies()).set(
    'sahaaya_oauth',
    JSON.stringify({ state, nonce, verifier, userId: auth?.user.id || null, calendar }),
    {
      httpOnly: true,
      secure: process.env.APP_URL?.startsWith('https://'),
      sameSite: 'lax',
      maxAge: 600,
      path: '/api/auth/google',
    },
  );
  const url = client.generateAuthUrl({
    access_type: calendar ? 'offline' : 'online',
    prompt: calendar ? 'consent' : 'select_account',
    scope: [
      'openid',
      'email',
      'profile',
      ...(calendar ? ['https://www.googleapis.com/auth/calendar.events.owned'] : []),
    ],
    state,
    nonce,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256' as import('google-auth-library').CodeChallengeMethod,
  });
  return Response.redirect(url, 302);
}
export async function googleCallback(request: Request) {
  const store = await cookies();
  const raw = store.get('sahaaya_oauth')?.value;
  store.delete('sahaaya_oauth');
  if (!raw) throw new ApiError(403, 'forbidden');
  const pending = pendingSchema.parse(JSON.parse(raw));
  const url = new URL(request.url);
  if (url.searchParams.get('state') !== pending.state || !url.searchParams.get('code'))
    throw new ApiError(403, 'forbidden');
  const client = oauthClient();
  const { tokens } = await client.getToken({
    code: url.searchParams.get('code')!,
    codeVerifier: pending.verifier,
  });
  if (!tokens.id_token) throw new ApiError(403, 'forbidden');
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (
    !payload?.email_verified ||
    !payload.email ||
    (payload as { nonce?: string }).nonce !== pending.nonce
  )
    throw new ApiError(403, 'forbidden');
  let account = await db.googleAccount.findUnique({ where: { subject: payload.sub } });
  let user = account ? await db.user.findUnique({ where: { id: account.userId } }) : null;
  if (pending.userId) {
    const auth = await authenticate();
    if (auth.user.id !== pending.userId || (account && account.userId !== pending.userId))
      throw new ApiError(403, 'forbidden');
    user = auth.user;
  }
  if (!user) {
    if (await db.user.findUnique({ where: { email: payload.email.toLowerCase() } }))
      throw new ApiError(409, 'conflict');
    user = await db.user.create({
      data: {
        name: payload.name || payload.email,
        email: payload.email.toLowerCase(),
        emailVerifiedAt: new Date(),
        preferences: { create: {} },
      },
    });
  }
  if (!account)
    account = await db.googleAccount.create({
      data: {
        userId: user.id,
        subject: payload.sub,
        scopes: tokens.scope || '',
        encryptedRefreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      },
    });
  else
    await db.googleAccount.update({
      where: { id: account.id },
      data: {
        scopes: tokens.scope || account.scopes,
        ...(tokens.refresh_token ? { encryptedRefreshToken: encrypt(tokens.refresh_token) } : {}),
      },
    });
  const login = pending.userId ? { mfaRequired: false } : await beginSignIn(user, request);
  if (login.mfaRequired) return Response.redirect(`${process.env.APP_URL}/mfa`, 302);
  return Response.redirect(
    `${process.env.APP_URL}/app/${pending.calendar ? 'settings' : 'home'}`,
    302,
  );
}
