import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
const results = JSON.parse(await readFile('test-results/results.json', 'utf8'));
const coverage = JSON.parse(await readFile('coverage/coverage-summary.json', 'utf8'));
const log = (await readFile('.data/coverage-release.log', 'utf8')).replace(/\u001b\[[0-9;]*m/g, '');
const units = Number(log.match(/Tests\s+(\d+) passed/)?.[1]);
if (
  !units ||
  results.stats.unexpected ||
  results.stats.flaky ||
  results.stats.skipped ||
  !results.stats.expected
)
  throw new Error('Release evidence requires successful completed test runs');
const hash = createHash('sha256');
async function fingerprint(directory) {
  for (const name of (await readdir(directory)).sort()) {
    const file = join(directory, name);
    const entries = await readdir(file).catch(() => null);
    if (entries) await fingerprint(file);
    else hash.update(file.replaceAll('\\', '/')).update(await readFile(file));
  }
}
for (const directory of ['src', 'prisma', 'tests', 'deploy']) await fingerprint(directory);
for (const file of ['package.json', 'package-lock.json', 'next.config.ts', 'vercel.json'])
  hash.update(file).update(await readFile(file));
await writeFile(
  'docs/evidence/release-validation.json',
  JSON.stringify(
    {
      author: 'BanuSreya',
      checkedAt: new Date().toISOString(),
      sourceFingerprint: hash.digest('hex'),
      unitTests: { passed: units },
      browserAndApiTests: results.stats,
      coverageScope: Object.keys(coverage)
        .filter((file) => file !== 'total')
        .map((file) => relative(process.cwd(), file).replaceAll('\\', '/'))
        .sort(),
      coverage: coverage.total,
      note: 'Coverage is for the listed modules, not the entire application. Public production checks are recorded separately. CI validates its own commit.',
    },
    null,
    2,
  ) + '\n',
);
console.log(`Recorded ${units} unit and ${results.stats.expected} browser/API passes.`);
