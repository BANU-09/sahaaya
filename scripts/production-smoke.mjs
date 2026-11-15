// Exercises only a new synthetic account and removes it afterwards. Never resets shared demos.
import { randomBytes, createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.SMOKE_ORIGIN || 'https://sahaaya-mauve.vercel.app';
if (new URL(origin).origin !== 'https://sahaaya-mauve.vercel.app')
  throw new Error('Unexpected smoke-test target');
const password = randomBytes(24).toString('base64url');
let cookie = '',
  created = false;
const checks = [];
async function call(path, method = 'GET', body, expected = 200, authenticated = true) {
  const response = await fetch(`${origin}/api/${path}`, {
    method,
    signal: AbortSignal.timeout(30000),
    headers: {
      Origin: origin,
      ...(authenticated && cookie ? { Cookie: cookie } : {}),
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const session = response.headers.getSetCookie().find((v) => v.startsWith('sahaaya_session='));
  if (session) cookie = session.split(';')[0];
  if (response.status !== expected)
    throw new Error(
      `${method} ${path.split('/')[0]} returned ${response.status}; expected ${expected}`,
    );
  return response;
}
try {
  const health = await (await call('health')).json();
  if (health.database !== 'connected' || !health.worker?.healthy)
    throw new Error('Production database/worker is unhealthy');
  checks.push('Public database and scheduled-worker health');
  await call('me', 'GET', undefined, 401, false);
  checks.push('Unauthenticated account access denied');
  const registered = await call('auth/register', 'POST', {
    name: 'SAHAAYA synthetic verification',
    email: `release-${randomBytes(8).toString('hex')}@example.invalid`,
    password,
    role: 'PATIENT',
    language: 'en',
    consent: true,
  });
  created = true;
  if (
    !registered.headers.get('set-cookie')?.includes('Secure') ||
    !registered.headers.get('set-cookie')?.includes('HttpOnly')
  )
    throw new Error('Session cookie protections missing');
  const me = await (await call('me')).json(),
    patient = me.patients[0].id;
  checks.push('Patient registration, secure cookie and persistent profile');
  const bytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ZkAAAAASUVORK5CYII=',
    'base64',
  );
  const form = new FormData();
  form.set('title', 'Synthetic release fixture');
  form.set('category', 'other');
  form.set('file', new Blob([bytes], { type: 'image/png' }), 'synthetic.png');
  const document = await (await call(`patients/${patient}/documents`, 'POST', form)).json();
  const path = `patients/${patient}/documents/${document.id}`;
  const download = await call(path);
  const same =
    createHash('sha256')
      .update(Buffer.from(await download.arrayBuffer()))
      .digest('hex') === createHash('sha256').update(bytes).digest('hex');
  if (!same || !download.headers.get('cache-control')?.includes('no-store'))
    throw new Error('Private file round-trip failed');
  await call(path, 'GET', undefined, 401, false);
  checks.push(
    'Private upload/download preserves bytes; anonymous download denied; no-store response',
  );
  const draft = await (
    await call(`patients/${patient}/companion-drafts`, 'POST', {
      kind: 'JOURNAL',
      payload: {
        mood: 'GOOD',
        note: 'Synthetic software check; no personal or medical information.',
      },
    })
  ).json();
  await call(`patients/${patient}/companion-drafts/${draft.id}`, 'POST', { confirmed: true });
  await call(`patients/${patient}/companion-drafts/${draft.id}`, 'POST', { confirmed: true }, 409);
  checks.push('Reviewed draft persists once; duplicate commit rejected');
  const exported = await (
    await call('privacy/export', 'POST', { currentPassword: password })
  ).json();
  if (
    exported.patient.journal.length !== 1 ||
    'passwordHash' in exported.user ||
    'mfaSecret' in exported.user
  )
    throw new Error('Export contract failed');
  checks.push('Reauthenticated export includes saved data and excludes credentials');
} finally {
  if (created) {
    await call('privacy/delete', 'POST', {
      currentPassword: password,
      confirmation: 'DELETE MY ACCOUNT',
    });
    await call('me', 'GET', undefined, 401);
    checks.push('Synthetic account deleted; session invalidated');
  }
}
await mkdir('docs/evidence', { recursive: true });
await writeFile(
  'docs/evidence/production-smoke.json',
  JSON.stringify({ origin, checkedAt: new Date().toISOString(), checks, passed: true }, null, 2) +
    '\n',
);
console.log(JSON.stringify({ passed: true, checks: checks.length }));
