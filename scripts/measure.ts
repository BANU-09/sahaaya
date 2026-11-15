import { writeFile } from 'node:fs/promises';

const origin = process.env.APP_URL || 'http://127.0.0.1:3100';
if (
  process.env.DEMO_MODE !== 'true' ||
  !['localhost', '127.0.0.1'].includes(new URL(origin).hostname)
) {
  throw new Error('Run only against a fictional local demo.');
}
const login = await fetch(`${origin}/api/auth/demo`, {
  method: 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ role: 'PATIENT', language: 'en' }),
});
if (!login.ok) throw new Error(`Demo sign-in failed: ${login.status}`);
const cookie = login.headers.get('set-cookie')?.split(';')[0];
if (!cookie) throw new Error('Missing demo session');
async function measure() {
  const start = performance.now();
  const result = await fetch(`${origin}/api/patients/demo-lakshmi/dashboard`, {
    headers: { Cookie: cookie! },
  });
  await result.arrayBuffer();
  if (!result.ok) throw new Error(`Dashboard request failed: ${result.status}`);
  return performance.now() - start;
}
for (let i = 0; i < 3; i++) await measure();
const sequential = [];
for (let i = 0; i < 25; i++) sequential.push(await measure());
const concurrent = [];
for (let i = 0; i < 5; i++)
  concurrent.push(...(await Promise.all(Array.from({ length: 5 }, measure))));
function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    requests: sorted.length,
    medianMs: Number(sorted[Math.floor(sorted.length / 2)].toFixed(1)),
    p95Ms: Number(sorted[Math.ceil(sorted.length * 0.95) - 1].toFixed(1)),
    maxMs: Number(sorted.at(-1)!.toFixed(1)),
  };
}
const report = {
  measuredAt: new Date().toISOString(),
  environment: 'Local Windows production Next.js / native PostgreSQL 18.6',
  node: process.version,
  scope: 'Warm authenticated dashboard full HTTP response, fictional records, no external network',
  poolSize: Number(process.env.DB_POOL_SIZE || 5),
  sequential: stats(sequential),
  concurrentFive: stats(concurrent),
  limitations:
    'Not a Lighthouse score, production capacity test, Internet latency or field Web Vitals.',
};
await writeFile('docs/evidence/performance.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
