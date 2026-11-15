import { test, expect, request as createRequest, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { db } from '../../src/server/db';

const base = 'http://127.0.0.1:3100';
const email = `route-boundaries-${randomUUID()}@example.invalid`;
let client: APIRequestContext;
let patientId: string;
let userId: string;

test.describe.serial('item routes reject missing IDs without bulk mutations', () => {
  test.beforeAll(async () => {
    client = await createRequest.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
    const registration = await client.post('/api/auth/register', {
      data: {
        name: 'Route boundary fixture',
        email,
        password: 'Disposable route boundary fixture 2026!',
        role: 'PATIENT',
        consent: true,
        language: 'en',
      },
    });
    expect(registration.status(), await registration.text()).toBe(200);
    userId = (await registration.json()).id;
    patientId = (await (await client.get('/api/me')).json()).patients[0].id;
    for (const index of [1, 2]) {
      await db.careTask.create({
        data: {
          patientId,
          title: `Fictional task ${index}`,
          note: 'Disposable local route-boundary fixture',
          dueAt: new Date(Date.now() + 86400000),
          createdBy: userId,
        },
      });
      await db.medication.create({
        data: {
          patientId,
          name: `Fictional medicine ${index}`,
          strength: 'Fixture only',
          dosage: 'Fixture only',
          instructions: 'Never for clinical use',
          doctor: 'Fictional doctor',
          status: 'ACTIVE',
          doses: {
            create: {
              patientId,
              scheduledAt: new Date(Date.now() + index * 3600000),
              alert: { create: { patientId, stage: 'FOLLOWUP' } },
            },
          },
        },
      });
      await db.visitSummary.create({
        data: { patientId, content: { fixture: true }, questions: `Fictional summary ${index}` },
      });
    }
    await db.notification.create({
      data: {
        userId,
        patientId,
        key: 'fixture',
        eventKey: `boundaries:${userId}`,
        channel: 'IN_APP',
        status: 'AVAILABLE',
      },
    });
  });

  test.afterAll(async () => {
    await client?.dispose();
    await db.user.deleteMany({ where: { email, demo: false } });
    await db.$disconnect();
  });

  test('collection task, alert and summary PATCH requests leave every item unchanged', async () => {
    const snapshot = async () =>
      Promise.all([
        db.careTask.findMany({
          where: { patientId },
          orderBy: { id: 'asc' },
          select: { id: true, status: true, completedAt: true },
        }),
        db.careAlert.findMany({
          where: { patientId },
          orderBy: { id: 'asc' },
          select: { id: true, stage: true, resolvedAt: true, followup: true },
        }),
        db.visitSummary.findMany({
          where: { patientId },
          orderBy: { id: 'asc' },
          select: { id: true, approvedAt: true, approvedBy: true },
        }),
      ]);
    const before = await snapshot();
    for (const [resource, data] of [
      ['tasks', { status: 'COMPLETED' }],
      ['alerts', { action: 'RESOLVE', followup: 'Must not change any alert' }],
      ['summaries', { approved: true }],
    ] as const) {
      const response = await client.patch(`/api/patients/${patientId}/${resource}`, { data });
      expect(response.status(), `${resource}: ${await response.text()}`).toBe(400);
    }
    expect(await snapshot()).toEqual(before);
  });

  test('collection DELETE cannot archive medicines, cancel doses or revoke memberships', async () => {
    const snapshot = async () =>
      Promise.all([
        db.medication.findMany({
          where: { patientId },
          orderBy: { id: 'asc' },
          select: { id: true, status: true },
        }),
        db.scheduledDose.findMany({
          where: { patientId },
          orderBy: { id: 'asc' },
          select: { id: true, status: true },
        }),
        db.membership.findMany({
          where: { circle: { patientId } },
          orderBy: { id: 'asc' },
          select: { id: true, revokedAt: true },
        }),
      ]);
    const before = await snapshot();
    for (const resource of ['medications', 'members']) {
      const response = await client.delete(`/api/patients/${patientId}/${resource}`);
      expect(response.status(), `${resource}: ${await response.text()}`).toBe(400);
    }
    expect(await snapshot()).toEqual(before);
  });

  test('other item mutations reject collection URLs and preserve sessions and unread notifications', async () => {
    for (const resource of ['medications', 'appointments', 'members', 'documents', 'handovers']) {
      const response = await client.patch(`/api/patients/${patientId}/${resource}`, { data: {} });
      expect(response.status(), `${resource}: ${await response.text()}`).toBe(400);
    }
    expect(
      (
        await client.post(`/api/patients/${patientId}/doses`, { data: { action: 'TAKEN' } })
      ).status(),
    ).toBe(400);
    const sessions = await db.session.findMany({
      where: { userId },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    const notices = await db.notification.findMany({
      where: { userId },
      select: { id: true, readAt: true },
      orderBy: { id: 'asc' },
    });
    expect((await client.delete('/api/sessions')).status()).toBe(400);
    expect((await client.patch('/api/notifications', { data: {} })).status()).toBe(400);
    expect(
      await db.session.findMany({
        where: { userId },
        select: { id: true },
        orderBy: { id: 'asc' },
      }),
    ).toEqual(sessions);
    expect(
      await db.notification.findMany({
        where: { userId },
        select: { id: true, readAt: true },
        orderBy: { id: 'asc' },
      }),
    ).toEqual(notices);
    expect((await client.get('/api/me')).status()).toBe(200);
  });
});
