import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parse } from 'dotenv';
const config = parse(await readFile('.data/production.env'));
if (
  !config.DIRECT_URL?.includes('neon.tech') ||
  config.APP_URL !== 'https://sahaaya-mauve.vercel.app'
)
  throw new Error('Unexpected production target');
const run = promisify(execFile);
for (const [name, args, database] of [
  ['migrations', ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], config.DIRECT_URL],
  ['fictional-seed', ['--import', 'tsx', 'scripts/seed.ts'], config.DATABASE_URL],
]) {
  try {
    await run(process.execPath, args, {
      env: { ...process.env, ...config, DATABASE_URL: database, NODE_ENV: 'production' },
      timeout: 180000,
    });
    console.log(`Production ${name} completed.`);
  } catch (error) {
    const safe = String(error.stderr || error.message).replace(
      /postgres(?:ql)?:\/\/[^\s"']+/g,
      '[DATABASE REDACTED]',
    );
    await writeFile(`.data/${name}-error.txt`, safe);
    throw new Error(`Production ${name} failed; redacted diagnostic saved locally.`);
  }
}
