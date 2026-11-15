import { randomUUID, randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { db } from '../src/server/db';

const origin = process.env.APP_URL || 'http://127.0.0.1:3100';
if (
  !process.env.GEMINI_API_KEY ||
  process.env.DEMO_MODE !== 'true' ||
  !['localhost', '127.0.0.1'].includes(new URL(origin).hostname)
) {
  throw new Error('Requires configured Gemini and an isolated local demo environment.');
}
const email = `gemini-check-${randomUUID()}@example.invalid`;
let userId: string | undefined,
  cookie = '';
async function post(path: string, data: unknown) {
  const response = await fetch(`${origin}/api/${path}`, {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(data),
  });
  const value = await response.json();
  if (!response.ok)
    throw new Error(`${path}: ${response.status} ${value.error || 'request_failed'}`);
  if (response.headers.get('set-cookie'))
    cookie = response.headers.get('set-cookie')!.split(';')[0];
  return value;
}
try {
  const user = await post('auth/register', {
    name: 'Fictional Gemini verification',
    email,
    password: randomBytes(32).toString('hex'),
    role: 'PATIENT',
    consent: true,
    language: 'en',
  });
  userId = user.id;
  const me = await (await fetch(`${origin}/api/me`, { headers: { Cookie: cookie } })).json();
  const patientId = me.patients[0].id;
  await post(`patients/${patientId}/appointments`, {
    doctor: 'Dr. Synthetic Gemini Check',
    specialty: 'Fictional test',
    hospital: 'Fictional Clinic',
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    purpose: 'Integration verification only',
  });
  const answer = await post(`patients/${patientId}/companion`, {
    question: 'What is my next appointment?',
    useAI: true,
  });
  if (
    answer.mode !== 'aiLookup' ||
    !answer.text.includes('Dr. Synthetic Gemini Check') ||
    answer.sources.length !== 1
  )
    throw new Error('Grounded answer did not match the synthetic appointment');
  const report = {
    checkedAt: new Date().toISOString(),
    provider: 'Google Gemini',
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    liveStatus: 'passed',
    checks: [
      'Real Gemini intent classification through authenticated companion API',
      'Answer retrieved from authorized PostgreSQL appointment',
      'One source record returned',
    ],
    data: 'Temporary fictional account and appointment only; only the generic question was sent to Gemini',
    limitations:
      'Does not validate Cloud Vision, arbitrary prescription accuracy or medical correctness',
  };
  await writeFile('docs/evidence/live-gemini-companion.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (userId) await db.user.deleteMany({ where: { id: userId, email, demo: false } });
  await db.$disconnect();
}
