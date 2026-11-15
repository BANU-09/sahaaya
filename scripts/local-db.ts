import EmbeddedPostgres from 'embedded-postgres';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const url = new URL(process.env.DATABASE_URL || '');
if (!['127.0.0.1', 'localhost'].includes(url.hostname))
  throw new Error('Local database requires a loopback DATABASE_URL');
const databaseName = url.pathname.slice(1);
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(databaseName)) throw new Error('Invalid local database name');
const directory = resolve('.data/postgres');
const postgres = new EmbeddedPostgres({
  databaseDir: directory,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  port: Number(url.port || 5432),
  persistent: true,
  authMethod: 'scram-sha-256',
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  postgresFlags: ['-h', '127.0.0.1'],
  onLog: () => {},
  onError: () => {},
});
if (
  !(await access(join(directory, 'PG_VERSION'))
    .then(() => true)
    .catch(() => false))
)
  await postgres.initialise();
await postgres.start();
const client = postgres.getPgClient();
await client.connect();
const exists = await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [databaseName]);
await client.end();
if (!exists.rowCount) await postgres.createDatabase(databaseName);
console.log(
  `Native PostgreSQL running on 127.0.0.1:${url.port || 5432}; data retained in .data/postgres.`,
);
await new Promise<void>((resolve) => {
  process.once('SIGINT', () => resolve());
  process.once('SIGTERM', () => resolve());
});
await postgres.stop();
