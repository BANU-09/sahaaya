import { test, expect, request as createRequest, type APIRequestContext } from '@playwright/test';
import { DateTime } from 'luxon';
import { randomUUID } from 'node:crypto';
import { db } from '../../src/server/db';
import { runScheduler } from '../../src/server/services/worker';
const base = 'http://127.0.0.1:3100';
const suffix = randomUUID();
const password = 'Sahaaya integration test 2026!';
let patient: APIRequestContext,
  family: APIRequestContext,
  caregiver: APIRequestContext,
  stranger: APIRequestContext,
  patientId: string,
  otherId: string,
  medicationId: string,
  doseId: string,
  memberId: string,
  documentId: string;
const userIds: string[] = [];
const post = (client: APIRequestContext, path: string, data: unknown) =>
  client.post(`/api/${path}`, { data });
test.describe.serial('real PostgreSQL API workflows', () => {
  test.beforeAll(async () => {
    async function register(role: string, name: string) {
      const client = await createRequest.newContext({
        baseURL: base,
        extraHTTPHeaders: { Origin: base },
      });
      const response = await post(client, 'auth/register', {
        name,
        email: `${name}-${suffix}@example.invalid`,
        password,
        role,
        consent: true,
        language: 'en',
      });
      expect(response.status(), await response.text()).toBe(200);
      userIds.push((await response.json()).id);
      return client;
    }
    patient = await register('PATIENT', 'patient');
    family = await register('FAMILY', 'family');
    caregiver = await register('CAREGIVER', 'caregiver');
    stranger = await register('PATIENT', 'stranger');
    patientId = (await (await patient.get('/api/me')).json()).patients[0].id;
    otherId = (await (await stranger.get('/api/me')).json()).patients[0].id;
  });
  test.afterAll(async () => {
    for (const client of [patient, family, caregiver, stranger]) await client?.dispose();
    await db.user.deleteMany({
      where: { id: { in: userIds }, email: { endsWith: `${suffix}@example.invalid` }, demo: false },
    });
    await db.$disconnect();
  });
  test('registration persists profiles; secure sessions; no doctor self-registration', async () => {
    const response = await patient.get('/api/me');
    expect(response.headers()['cache-control']).toContain('no-store');
    expect((await response.json()).user).not.toHaveProperty('passwordHash');
    const storage = await patient.storageState();
    expect(storage.cookies.find((c) => c.name === 'sahaaya_session')).toMatchObject({
      httpOnly: true,
      sameSite: 'Lax',
    });
    const fakeDoctor = await post(stranger, 'auth/register', {
      name: 'fake',
      email: `fake-${suffix}@example.invalid`,
      password,
      consent: true,
      role: 'DOCTOR',
    });
    expect(fakeDoctor.status()).toBe(400);
  });
  test('onboarding requires consent and creates only the signed-in patient profile once', async () => {
    expect((await post(family, 'onboarding', { consent: false })).status()).toBe(400);
    const result = await post(family, 'onboarding', { consent: true });
    expect(result.status()).toBe(200);
    const me = await (await family.get('/api/me')).json();
    expect(me.patients[0].role).toBe('PATIENT');
    expect(me.patients[0].name).toBe('family');
    expect((await post(family, 'onboarding', { consent: true })).status()).toBe(409);
  });
  test('backend denies cross-patient reads, writes, and invalid CSRF origins', async () => {
    for (const resource of ['dashboard', 'documents', 'audit', 'profile', 'analytics'])
      expect((await stranger.get(`/api/patients/${patientId}/${resource}`)).status()).toBe(403);
    expect(
      (
        await post(stranger, `patients/${patientId}/journal`, { mood: 'GOOD', note: 'forbidden' })
      ).status(),
    ).toBe(403);
    const csrf = await patient.post(`/api/patients/${patientId}/journal`, {
      headers: { Origin: 'https://attacker.invalid' },
      data: { mood: 'GOOD', note: 'forbidden' },
    });
    expect(csrf.status()).toBe(403);
    const anonymous = await createRequest.newContext({ baseURL: base });
    expect((await anonymous.get(`/api/patients/${patientId}/dashboard`)).status()).toBe(401);
    await anonymous.dispose();
  });
  test('patient-consented invitations are single-use and cannot link to a different email', async () => {
    const invite = await post(patient, `patients/${patientId}/invitations`, {
      email: `family-${suffix}@example.invalid`,
      role: 'FAMILY',
      relationship: 'Son',
      permissions: ['profile.view', 'medications.view', 'appointments.manage', 'tasks.manage'],
    });
    expect(invite.status()).toBe(200);
    const token = new URL((await invite.json()).url).searchParams.get('token');
    expect((await post(stranger, 'invitations', { token })).status()).toBe(403);
    expect((await post(family, 'invitations', { token })).status()).toBe(200);
    expect((await post(family, 'invitations', { token })).status()).toBe(403);
    const data = await (await patient.get(`/api/patients/${patientId}/dashboard`)).json();
    memberId = data.members.find((m: { user: { name: string } }) => m.user.name === 'family').id;
    expect((await family.get(`/api/patients/${patientId}/dashboard`)).status()).toBe(200);
  });
  test('only approved medication generates schedules and approvals require permission', async () => {
    const now = DateTime.now().setZone('Asia/Kolkata').plus({ minutes: 10 });
    const result = await post(patient, `patients/${patientId}/medications`, {
      name: 'Fictional medicine',
      strength: '5 mg',
      dosage: '1 tablet',
      instructions: 'Test only',
      doctor: 'Fictional doctor',
      initialStock: 10,
      schedule: {
        frequency: 'DAILY',
        times: [now.toFormat('HH:mm')],
        weekdays: [],
        startDate: now.toISODate(),
        endDate: null,
        timezone: 'Asia/Kolkata',
      },
    });
    expect(result.status(), await result.text()).toBe(200);
    medicationId = (await result.json()).id;
    expect(await db.scheduledDose.count({ where: { medicationId } })).toBe(0);
    expect(
      (
        await post(family, `patients/${patientId}/medications/${medicationId}/approve`, {
          verified: true,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await post(patient, `patients/${patientId}/medications/${medicationId}/approve`, {
          verified: false,
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await post(patient, `patients/${patientId}/medications/${medicationId}/approve`, {
          verified: true,
        })
      ).status(),
    ).toBe(200);
    const doses = await db.scheduledDose.findMany({
      where: { medicationId },
      orderBy: { scheduledAt: 'asc' },
    });
    expect(doses.length).toBeGreaterThan(0);
    doseId = doses[0].id;
    expect(
      (await post(stranger, `patients/${otherId}/doses/${doseId}`, { action: 'TAKEN' })).status(),
    ).toBe(404);
  });
  test('dose confirmation is atomic and synchronized; unauthorized confirmations fail', async () => {
    expect(
      (await post(family, `patients/${patientId}/doses/${doseId}`, { action: 'TAKEN' })).status(),
    ).toBe(403);
    expect(
      (
        await post(patient, `patients/${patientId}/doses/${doseId}`, { action: 'SNOOZED' })
      ).status(),
    ).toBe(200);
    const responses = await Promise.all([
      post(patient, `patients/${patientId}/doses/${doseId}`, { action: 'TAKEN' }),
      post(patient, `patients/${patientId}/doses/${doseId}`, { action: 'TAKEN' }),
    ]);
    expect(responses.map((r) => r.status()).sort()).toEqual([200, 409]);
    expect(await db.doseEvent.count({ where: { doseId, status: 'TAKEN' } })).toBe(1);
    const data = await (await family.get(`/api/patients/${patientId}/dashboard`)).json();
    expect(data.doses.find((d: { id: string }) => d.id === doseId).status).toBe('TAKEN');
    expect(data.medications.find((m: { id: string }) => m.id === medicationId).estimatedStock).toBe(
      9,
    );
    expect(
      (
        await post(patient, `patients/${patientId}/doses/${doseId}`, { action: 'SNOOZED' })
      ).status(),
    ).toBe(409);
  });
  test('caregiver doses require an explicit witnessed confirmation', async () => {
    const invite = await post(patient, `patients/${patientId}/invitations`, {
      email: `caregiver-${suffix}@example.invalid`,
      role: 'CAREGIVER',
      relationship: 'Carer',
      permissions: ['profile.view', 'medications.view', 'doses.confirm', 'tasks.manage'],
    });
    const token = new URL((await invite.json()).url).searchParams.get('token');
    expect((await post(caregiver, 'invitations', { token })).status()).toBe(200);
    const dose = await db.scheduledDose.create({
      data: { patientId, medicationId, scheduledAt: new Date(Date.now() - 60 * 60000) },
    });
    expect(
      (
        await post(caregiver, `patients/${patientId}/doses/${dose.id}`, { action: 'TAKEN' })
      ).status(),
    ).toBe(400);
    expect(
      (
        await post(caregiver, `patients/${patientId}/doses/${dose.id}`, {
          action: 'TAKEN',
          witnessed: true,
        })
      ).status(),
    ).toBe(200);
    expect((await db.doseEvent.findFirst({ where: { doseId: dose.id } }))?.source).toBe(
      'WITNESSED',
    );
  });
  test('care loop escalates, is idempotent, and acknowledgment does not invent a missed dose', async () => {
    const dose = await db.scheduledDose.create({
      data: { patientId, medicationId, scheduledAt: new Date(Date.now() - 45 * 60000) },
    });
    await runScheduler();
    const first = await db.notification.count({ where: { patientId } });
    await runScheduler();
    expect(await db.notification.count({ where: { patientId } })).toBe(first);
    const alert = await db.careAlert.findUniqueOrThrow({ where: { doseId: dose.id } });
    expect(alert.stage).toBe('ESCALATED');
    expect((await db.scheduledDose.findUnique({ where: { id: dose.id } }))?.status).toBe('PENDING');
    expect(
      (
        await caregiver.patch(`/api/patients/${patientId}/alerts/${alert.id}`, {
          data: { action: 'ACKNOWLEDGE', followup: 'Contacting patient to check' },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await caregiver.patch(`/api/patients/${patientId}/alerts/${alert.id}`, {
          data: { action: 'RESOLVE', followup: 'Patient contacted; clinician advice requested' },
        })
      ).status(),
    ).toBe(200);
    expect((await db.scheduledDose.findUnique({ where: { id: dose.id } }))?.status).toBe('PENDING');
  });
  test('appointments remain requested without a confirmation reference; summaries need patient approval', async () => {
    const response = await post(family, `patients/${patientId}/appointments`, {
      doctor: 'Test doctor',
      specialty: 'General',
      hospital: 'Fictional hospital',
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      purpose: 'Test follow-up',
    });
    expect(response.status()).toBe(200);
    const appointment = await response.json();
    expect(appointment.status).toBe('REQUESTED');
    const calendarPath = `/api/patients/${patientId}/appointments/${appointment.id}/calendar.ics`;
    const calendar = await patient.get(calendarPath);
    expect(calendar.status()).toBe(200);
    expect(calendar.headers()['content-type']).toContain('text/calendar');
    expect(calendar.headers()['cache-control']).toContain('no-store');
    const calendarText = await calendar.text();
    expect(calendarText).toContain('STATUS:TENTATIVE');
    expect(calendarText).not.toContain('Test doctor');
    expect(calendarText).not.toContain('Test follow-up');
    expect((await stranger.get(calendarPath)).status()).toBe(403);
    expect(
      (
        await family.patch(`/api/patients/${patientId}/appointments/${appointment.id}`, {
          data: { status: 'CONFIRMED' },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await family.patch(`/api/patients/${patientId}/appointments/${appointment.id}`, {
          data: { status: 'CONFIRMED', confirmationReference: 'TEST-REF-001' },
        })
      ).status(),
    ).toBe(200);
    const summaryResponse = await post(patient, `patients/${patientId}/summaries`, {
      questions: 'Questions for the fictional doctor',
    });
    expect(summaryResponse.status()).toBe(200);
    const summary = await summaryResponse.json();
    expect(summary.approvedAt).toBeNull();
    expect(
      (
        await family.patch(`/api/patients/${patientId}/summaries/${summary.id}`, {
          data: { approved: true },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await patient.patch(`/api/patients/${patientId}/summaries/${summary.id}`, {
          data: { approved: true },
        })
      ).status(),
    ).toBe(200);
  });
  test('private files require record access; MIME spoofing and cross-patient downloads fail', async () => {
    const response = await patient.post(`/api/patients/${patientId}/documents`, {
      multipart: {
        title: 'Test PDF',
        category: 'prescription',
        file: {
          name: 'test.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4\nThis is a fictional test fixture only.'),
        },
      },
    });
    expect(response.status()).toBe(200);
    documentId = (await response.json()).id;
    expect((await patient.get(`/api/patients/${patientId}/documents/${documentId}`)).status()).toBe(
      200,
    );
    expect((await family.get(`/api/patients/${patientId}/documents/${documentId}`)).status()).toBe(
      403,
    );
    expect((await stranger.get(`/api/patients/${otherId}/documents/${documentId}`)).status()).toBe(
      404,
    );
    expect(
      (
        await patient.post(`/api/patients/${patientId}/documents`, {
          multipart: {
            file: {
              name: 'bad.png',
              mimeType: 'image/png',
              buffer: Buffer.from('<script>invalid document contents</script>'),
            },
          },
        })
      ).status(),
    ).toBe(415);
    expect(
      (await post(patient, `patients/${patientId}/scan`, { documentId, consent: false })).status(),
    ).toBe(403);
    expect((await post(patient, `patients/${patientId}/scan`, { sample: true })).status()).toBe(
      403,
    );
  });
  test('AI record lookup uses authorized data and reports missing live configuration', async () => {
    const response = await post(family, `patients/${patientId}/companion`, {
      question: 'What is my next appointment?',
    });
    expect(response.status()).toBe(200);
    expect((await response.json()).text).toContain('Test doctor');
    expect(
      (
        await post(stranger, `patients/${patientId}/companion`, { question: 'What medicines?' })
      ).status(),
    ).toBe(403);
    if (!process.env.GEMINI_API_KEY)
      expect(
        (
          await post(patient, `patients/${patientId}/companion`, {
            question: 'Next appointment',
            useAI: true,
          })
        ).status(),
      ).toBe(503);
    const emergency = await post(patient, `patients/${patientId}/companion`, {
      question: 'I have chest pain and cannot breathe',
    });
    expect((await emergency.json()).text).toContain('emergency');
  });
  test('drafts can be edited; as-needed confirmations are explicit and replay-safe', async () => {
    const medication = {
      name: 'As-needed fictional medicine',
      strength: 'test',
      dosage: 'As prescribed',
      doctor: 'Test doctor',
      instructions: 'Test only',
      unitsPerDose: 1,
      initialStock: 10,
      schedule: {
        frequency: 'PRN',
        times: [],
        weekdays: [],
        startDate: DateTime.now().setZone('Asia/Kolkata').toISODate(),
        timezone: 'Asia/Kolkata',
      },
    };
    const draft = await post(patient, `patients/${patientId}/medications`, medication);
    expect(draft.status()).toBe(200);
    const id = (await draft.json()).id;
    const path = `/api/patients/${patientId}/medications/${id}`;
    expect(
      (await family.patch(path, { data: { ...medication, name: 'Forbidden' } })).status(),
    ).toBe(403);
    expect(
      (
        await patient.patch(path, { data: { ...medication, name: 'Verified PRN medicine' } })
      ).status(),
    ).toBe(200);
    expect(await db.scheduledDose.count({ where: { medicationId: id } })).toBe(0);
    expect(
      (
        await post(patient, `patients/${patientId}/medications/${id}/approve`, { verified: true })
      ).status(),
    ).toBe(200);
    expect((await patient.patch(path, { data: medication })).status()).toBe(409);
    const requestId = randomUUID();
    const prn = `patients/${patientId}/medications/${id}/prn`;
    expect((await post(caregiver, prn, { requestId, verified: true })).status()).toBe(400);
    expect((await post(patient, prn, { requestId, verified: true })).status()).toBe(200);
    expect((await post(patient, prn, { requestId, verified: true })).status()).toBe(200);
    expect(await db.scheduledDose.count({ where: { medicationId: id, status: 'TAKEN' } })).toBe(1);
    expect(await db.doseEvent.count({ where: { dose: { medicationId: id } } })).toBe(1);
  });
  test('emergency links can be revoked and patient permissions can be withdrawn immediately', async () => {
    const share = await post(patient, `patients/${patientId}/emergency-share`, {});
    const token = new URL((await share.json()).url).searchParams.get('token');
    expect((await stranger.get(`/api/passport/${token}`)).status()).toBe(200);
    expect((await patient.delete(`/api/patients/${patientId}/emergency-share`)).status()).toBe(200);
    expect((await stranger.get(`/api/passport/${token}`)).status()).toBe(404);
    expect((await patient.delete(`/api/patients/${patientId}/members/${memberId}`)).status()).toBe(
      200,
    );
    expect((await family.get(`/api/patients/${patientId}/dashboard`)).status()).toBe(403);
  });
  test('PIN is device-session bound and sessions can expire or be revoked', async () => {
    expect(
      (
        await patient.patch('/api/settings', { data: { pin: '739482', currentPassword: password } })
      ).status(),
    ).toBe(200);
    expect((await post(patient, 'auth/lock', {})).status()).toBe(200);
    expect((await patient.get('/api/me')).status()).toBe(423);
    expect((await post(patient, 'auth/unlock', { pin: '000000' })).status()).toBe(401);
    expect((await post(patient, 'auth/unlock', { pin: '739482' })).status()).toBe(200);
    expect((await post(patient, 'auth/logout', {})).status()).toBe(200);
    expect((await patient.get('/api/me')).status()).toBe(401);
    expect(
      (
        await post(patient, 'auth/login', {
          identity: `patient-${suffix}@example.invalid`,
          password,
        })
      ).status(),
    ).toBe(200);
    await db.session.updateMany({
      where: { userId: userIds[0] },
      data: { expiresAt: new Date(0) },
    });
    expect((await patient.get('/api/me')).status()).toBe(401);
  });
});
