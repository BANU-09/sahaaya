import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parse } from 'dotenv';
import * as webpush from 'web-push';
const file = '.data/production.env';
const env = parse(await readFile(file));
env.DIRECT_URL ||= env.DATABASE_URL;
env.DATABASE_URL = env.DATABASE_URL_POOLED || env.DATABASE_URL;
delete env.DATABASE_URL_POOLED;
env.APP_URL = 'https://sahaaya-mauve.vercel.app';
env.TOKEN_ENCRYPTION_KEY ||= randomBytes(32).toString('base64');
env.WORKER_SECRET ||= randomBytes(32).toString('hex');
env.STORAGE_PROVIDER = 'postgres';
env.DB_POOL_SIZE = '3';
env.DEMO_MODE = 'true';
env.GEMINI_PRIVATE_DATA_ALLOWED = 'false';
env.WORKER_HEALTH_TIMEOUT_MS = '900000';
env.REMINDER_CHECK_MINUTES = '10';
if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
  const keys = webpush.generateVAPIDKeys();
  env.VAPID_PUBLIC_KEY = keys.publicKey;
  env.VAPID_PRIVATE_KEY = keys.privateKey;
}
await writeFile(
  file,
  Object.entries(env)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join('\n') + '\n',
  { mode: 0o600 },
);
console.log('Production environment prepared without displaying credentials.');
if (process.argv.includes('--upload')) {
  await mkdir('.data', { recursive: true });
  const cli = join(process.env.APPDATA, 'npm/node_modules/vercel/dist/index.js');
  const project = JSON.parse(await readFile('.vercel/project.json', 'utf8'));
  if (!project.projectId || !project.orgId)
    throw new Error('Unexpected deployment target');
  for (const [key, value] of Object.entries(env)) {
    const bodyPath = '.data/vercel-env-input.json';
    await writeFile(
      bodyPath,
      JSON.stringify({ key, value, type: 'encrypted', target: ['production'] }),
      { mode: 0o600 },
    );
    try {
      await promisify(execFile)(
        process.execPath,
        [
          cli,
          'api',
          `/v10/projects/${project.projectId}/env?teamId=${project.orgId}&upsert=true`,
          '--method',
          'POST',
          '--input',
          bodyPath,
          '--scope',
          project.orgId,
        ],
        { timeout: 60000 },
      );
      console.log(`Configured ${key}`);
    } catch {
      throw new Error(
        `Failed configuring ${key}; provider response withheld to avoid exposing credentials.`,
      );
    }
  }
  await writeFile('.data/vercel-env-input.json', '{}');
}
