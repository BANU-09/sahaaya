import { test, expect, request, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { Secret, TOTP } from 'otpauth';
import { db } from '../../src/server/db';
import { samplePdf } from '../../src/server/services/demo';
import { transcriptFields } from '../../src/lib/extraction';
const base = 'http://127.0.0.1:3100',
  password = 'Test security fixture 2026!',
  suffix = randomUUID();
const ids: string[] = [],
  clients: APIRequestContext[] = [];
let owner: APIRequestContext,
  carer: APIRequestContext,
  stranger: APIRequestContext,
  patientId: string,
  ownerId: string,
  carerId: string,
  documentId: string;
async function client() {
  const c = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
  clients.push(c);
  return c;
}
async function register(name: string, role = 'PATIENT') {
  const c = await client();
  const r = await c.post('/api/auth/register', {
    data: {
      name,
      email: `${name}-${suffix}@example.invalid`,
      password,
      role,
      consent: true,
      language: 'en',
    },
  });
  expect(r.status(), await r.text()).toBe(200);
  const user = await r.json();
  ids.push(user.id);
  return { c, id: user.id };
}
test.describe.serial('completion features on isolated local PostgreSQL fixtures', () => {
  test.beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('127.0.0.1'))
      throw new Error('This suite requires the local database');
    const first = await register('completion-owner');
    owner = first.c;
    ownerId = first.id;
    const second = await register('completion-carer', 'CAREGIVER');
    carer = second.c;
    carerId = second.id;
    stranger = (await register('completion-stranger')).c;
    patientId = (await (await owner.get('/api/me')).json()).patients[0].id;
    const circle = await db.careCircle.findUniqueOrThrow({ where: { patientId } });
    await db.membership.create({
      data: {
        circleId: circle.id,
        userId: carerId,
        role: 'CAREGIVER',
        relationship: 'Test fixture',
        consentedAt: new Date(),
        permissions: {
          create: ['profile.view', 'medications.view', 'journal.view', 'tasks.manage'].map(
            (key) => ({ key }),
          ),
        },
      },
    });
  });
  test.afterAll(async () => {
    for (const c of clients) await c.dispose();
    await db.user.deleteMany({
      where: { id: { in: ids }, email: { endsWith: `${suffix}@example.invalid` } },
    });
    await db.$disconnect();
  });

  test('document edits preserve history and reject concurrent stale revisions', async () => {
    const upload = await owner.post(`/api/patients/${patientId}/documents`, {
      multipart: {
        title: 'Original fixture report',
        category: 'report',
        file: { name: 'fixture.pdf', mimeType: 'application/pdf', buffer: samplePdf() },
      },
    });
    expect(upload.status()).toBe(200);
    documentId = (await upload.json()).id;
    const path = `/api/patients/${patientId}/documents/${documentId}`;
    const updates = await Promise.all(
      ['Reviewed A', 'Reviewed B'].map((title) =>
        owner.patch(path, {
          data: { title, category: 'report', notes: 'Reviewed fixture', version: 1 },
        }),
      ),
    );
    expect(updates.map((r) => r.status()).sort()).toEqual([200, 409]);
    const history = await (await owner.get(`${path}/history`)).json();
    expect(history.version).toBe(2);
    expect(history.revisions).toHaveLength(1);
    expect(history.revisions[0].title).toBe('Original fixture report');
    expect((await stranger.get(`${path}/history`)).status()).toBe(403);
    expect((await owner.get(path)).headers()['content-disposition']).toContain('attachment');
  });
  test('companion drafts require confirmation, permission and single-use commit', async () => {
    const path = `/api/patients/${patientId}/companion-drafts`;
    const payload = {
      kind: 'JOURNAL',
      payload: { mood: 'GOOD', note: 'Fictional reviewed draft' },
    };
    expect((await stranger.post(path, { data: payload })).status()).toBe(403);
    const created = await owner.post(path, { data: payload });
    expect(created.status()).toBe(200);
    const draft = await created.json();
    expect(await db.journalEntry.count({ where: { patientId } })).toBe(0);
    expect((await owner.post(`${path}/${draft.id}`, { data: { confirmed: false } })).status()).toBe(
      400,
    );
    const results = await Promise.all(
      [1, 2].map(() => owner.post(`${path}/${draft.id}`, { data: { confirmed: true } })),
    );
    expect(results.map((r) => r.status()).sort()).toEqual([200, 409]);
    expect(await db.journalEntry.count({ where: { patientId } })).toBe(1);
  });
  test('unverified doctor applications cannot approve themselves or access patients', async () => {
    const application = {
      registrationNumber: 'TEST-NOT-A-LICENSE',
      specialty: 'Test fixture',
      hospital: 'Fictional',
      contact: '',
      location: '',
      consultationHours: '',
    };
    const result = await stranger.post('/api/doctor-profile', { data: application });
    expect(result.status()).toBe(200);
    expect((await result.json()).verifiedAt).toBeNull();
    expect((await stranger.get('/api/operator/doctors')).status()).toBe(403);
    expect((await stranger.get(`/api/patients/${patientId}/dashboard`)).status()).toBe(403);
  });
  test('push subscriptions reject arbitrary destinations and receipts are user scoped', async () => {
    const subscription = {
      endpoint: 'https://127.0.0.1/private',
      keys: { p256dh: 'A'.repeat(87), auth: 'B'.repeat(22) },
    };
    expect((await owner.post('/api/push', { data: { subscription } })).status()).toBe(400);
    expect(
      (
        await owner.post('/api/push', {
          data: { token: `webpush:${JSON.stringify(subscription)}` },
        })
      ).status(),
    ).toBe(400);
    const notification = await db.notification.create({
      data: {
        userId: ownerId,
        channel: 'PUSH',
        key: 'test',
        eventKey: `test:${suffix}`,
        status: 'ACCEPTED',
      },
    });
    await stranger.post('/api/push/receipt', { data: { notificationId: notification.id } });
    expect(
      (await db.notification.findUniqueOrThrow({ where: { id: notification.id } })).status,
    ).toBe('ACCEPTED');
    await owner.post('/api/push/receipt', { data: { notificationId: notification.id } });
    expect(
      (await db.notification.findUniqueOrThrow({ where: { id: notification.id } })).status,
    ).toBe('DELIVERED');
  });
  test('local extraction retains provenance and requires each field to be reviewed', async () => {
    const text = '[Page 1]\nTest: 12.5 mg/dL';
    const payload = {
      kind: 'report',
      text,
      confidence: 0.71,
      pages: 1,
      totalPages: 1,
      barcodes: [],
      fields: transcriptFields(text),
    };
    const path = `/api/patients/${patientId}/documents/${documentId}/extractions`;
    expect((await stranger.post(path, { data: payload })).status()).toBe(403);
    const created = await owner.post(path, { data: payload });
    expect(created.status()).toBe(200);
    const draft = await created.json();
    expect(draft.status).toBe('DRAFT');
    expect(draft.source).toBe('BROWSER_TESSERACT_USER_REVIEW');
    expect(
      (
        await owner.patch(path, { data: { id: draft.id, version: 0, verified: true, payload } })
      ).status(),
    ).toBe(400);
    const reviewed = {
      ...payload,
      fields: payload.fields.map((f) => ({ ...f, uncertain: false })),
    };
    expect(
      (
        await owner.patch(path, {
          data: { id: draft.id, version: 0, verified: true, payload: reviewed },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await owner.patch(path, {
          data: { id: draft.id, version: 0, verified: true, payload: reviewed },
        })
      ).status(),
    ).toBe(409);
    expect(await db.medication.count({ where: { patientId } })).toBe(0);
  });
  test('handovers limit snapshots to shared permissions and require recipient acknowledgement', async () => {
    const path = `/api/patients/${patientId}/handovers`;
    const created = await owner.post(path, {
      data: {
        recipientId: carerId,
        observations: 'Fictional handover',
        responsibilities: 'Review the next check-in',
      },
    });
    expect(created.status()).toBe(200);
    const item = await created.json();
    expect(item.snapshot.appointments).toEqual([]);
    expect(
      (await owner.patch(`${path}/${item.id}`, { data: { acknowledged: true } })).status(),
    ).toBe(409);
    expect(
      (await carer.patch(`${path}/${item.id}`, { data: { acknowledged: true } })).status(),
    ).toBe(200);
    expect(
      (await carer.patch(`${path}/${item.id}`, { data: { acknowledged: true } })).status(),
    ).toBe(409);
    const member = await db.membership.findFirstOrThrow({
      where: { userId: carerId, circle: { patientId } },
    });
    await db.permission.deleteMany({ where: { membershipId: member.id, key: 'journal.view' } });
    expect((await carer.get(path)).status()).toBe(403);
    expect((await stranger.get(path)).status()).toBe(403);
  });
  test('custom analytics uses inclusive local dates and rejects invalid ranges', async () => {
    const path = `/api/patients/${patientId}/analytics`;
    const r = await owner.get(`${path}?from=2026-11-01&to=2026-11-03`);
    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(data.days).toBe(3);
    expect(data.daily.map((d: { date: string }) => d.date)).toEqual([
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
    ]);
    for (const q of [
      'from=2026-11-03&to=2026-11-01',
      'from=2026-11-01',
      'days=367',
      'from=2026-02-30&to=2026-03-01',
    ])
      expect((await owner.get(`${path}?${q}`)).status()).toBe(400);
    const carerAnalytics = await (await carer.get(`${path}?days=7`)).json();
    expect(carerAnalytics.vitals).toEqual([]);
  });
  test('export requires fresh identity proof and excludes account credentials', async () => {
    expect(
      (await owner.post('/api/privacy/export', { data: { currentPassword: 'wrong' } })).status(),
    ).toBe(403);
    const exported = await owner.post('/api/privacy/export', {
      data: { currentPassword: password },
    });
    expect(exported.status()).toBe(200);
    const text = await exported.text();
    expect(text).not.toMatch(/passwordHash|pinHash|mfaSecret|tokenHash|storageKey/);
    expect(JSON.parse(text).patient.id).toBe(patientId);
  });
  test('authenticator enrollment prevents session creation until MFA, including replay protection', async () => {
    const enrollment = await owner.post('/api/security/mfa-start', {
      data: { currentPassword: password },
    });
    expect(enrollment.status()).toBe(200);
    const { secret } = await enrollment.json();
    const authenticator = new TOTP({
      issuer: 'SAHAAYA',
      secret: Secret.fromBase32(secret),
      digits: 6,
      period: 30,
      algorithm: 'SHA1',
    });
    const enabled = await owner.post('/api/security/mfa-enable', {
      data: { code: authenticator.generate() },
    });
    expect(enabled.status()).toBe(200);
    const { codes } = await enabled.json();
    expect(codes).toHaveLength(10);
    const login = await client();
    const first = await login.post('/api/auth/login', {
      data: { identity: `completion-owner-${suffix}@example.invalid`, password },
    });
    expect((await first.json()).mfaRequired).toBe(true);
    expect((await login.get('/api/me')).status()).toBe(401);
    const code = authenticator.generate({ timestamp: Date.now() + 30000 });
    const concurrent = await Promise.all(
      [1, 2].map(() => login.post('/api/auth/mfa', { data: { code } })),
    );
    expect(concurrent.filter((r) => r.status() === 200)).toHaveLength(1);
    expect((await login.get('/api/me')).status()).toBe(200);
    const recovery = await client();
    await recovery.post('/api/auth/login', {
      data: { identity: `completion-owner-${suffix}@example.invalid`, password },
    });
    expect((await recovery.post('/api/auth/mfa', { data: { code: codes[0] } })).status()).toBe(200);
    const reuse = await client();
    await reuse.post('/api/auth/login', {
      data: { identity: `completion-owner-${suffix}@example.invalid`, password },
    });
    expect((await reuse.post('/api/auth/mfa', { data: { code: codes[0] } })).status()).toBe(403);
    expect((await reuse.get('/api/me')).status()).toBe(401);
    const stored = await db.user.findUniqueOrThrow({ where: { id: ownerId } });
    expect(stored.mfaSecret).not.toContain(secret);
  });
  test('deletion is explicit, password-protected, and revokes the session', async () => {
    const { c, id } = await register('completion-delete');
    expect(
      (
        await c.post('/api/privacy/delete', {
          data: { currentPassword: password, confirmation: 'NO' },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await c.post('/api/privacy/delete', {
          data: { currentPassword: password, confirmation: 'DELETE MY ACCOUNT' },
        })
      ).status(),
    ).toBe(200);
    expect(await db.user.findUnique({ where: { id } })).toBeNull();
    expect((await c.get('/api/me')).status()).toBe(401);
  });
  test('internal scheduler rejects unauthenticated and malformed calls', async () => {
    expect((await owner.post('/api/internal/worker')).status()).toBe(401);
    expect(
      (
        await owner.post('/api/internal/worker', { headers: { Authorization: 'Bearer short' } })
      ).status(),
    ).toBe(401);
  });
});
