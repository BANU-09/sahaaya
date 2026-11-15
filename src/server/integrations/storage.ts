import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Storage } from '@google-cloud/storage';
import { ApiError } from '../errors';
import { db } from '../db';
import { encrypt, decrypt } from '../crypto';
export function validateFile(buffer: Buffer, mime: string) {
  if (buffer.length > 3 * 1024 * 1024 || buffer.length < 20) throw new ApiError(413, 'tooLarge');
  const valid =
    (mime === 'application/pdf' && buffer.subarray(0, 5).toString() === '%PDF-') ||
    (mime === 'image/png' &&
      buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (mime === 'image/jpeg' && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255);
  if (!valid) throw new ApiError(415, 'unsupportedFile');
}
export async function saveFile(buffer: Buffer, mime: string) {
  validateFile(buffer, mime);
  const key = randomUUID();
  if (process.env.STORAGE_PROVIDER === 'postgres') {
    if (buffer.length > 3 * 1024 * 1024) throw new ApiError(413, 'tooLarge');
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(7319282)::text`;
      const used = await tx.storedObject.aggregate({ _sum: { size: true } });
      if ((used._sum.size || 0) + buffer.length > 200 * 1024 * 1024)
        throw new ApiError(507, 'storageFull');
      await tx.storedObject.create({
        data: { id: key, ciphertext: encrypt(buffer.toString('base64')), size: buffer.length },
      });
    });
    return `postgres:${key}`;
  }
  if (process.env.GCS_BUCKET) {
    await new Storage()
      .bucket(process.env.GCS_BUCKET)
      .file(key)
      .save(buffer, {
        resumable: false,
        contentType: mime,
        metadata: { cacheControl: 'private, no-store' },
      });
    return `gcs:${key}`;
  }
  if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true')
    throw new ApiError(503, 'notConfigured');
  const directory = join(process.cwd(), '.data', 'uploads');
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, key), buffer, { flag: 'wx' });
  return `local:${key}`;
}
export async function loadFile(storageKey: string) {
  const [kind, key] = storageKey.split(':');
  if (!/^[\da-f-]{36}$/.test(key)) throw new ApiError(404, 'notFound');
  if (kind === 'postgres') {
    const object = await db.storedObject.findUnique({ where: { id: key } });
    if (!object) throw new ApiError(404, 'notFound');
    return Buffer.from(decrypt(object.ciphertext), 'base64');
  }
  if (kind === 'gcs' && process.env.GCS_BUCKET)
    return (await new Storage().bucket(process.env.GCS_BUCKET).file(key).download())[0];
  if (kind === 'local') return readFile(join(join(process.cwd(), '.data', 'uploads'), key));
  throw new ApiError(404, 'notFound');
}

export async function deleteFile(storageKey: string) {
  const [kind, key] = storageKey.split(':');
  if (!/^[\da-f-]{36}$/.test(key)) throw new ApiError(404, 'notFound');
  if (kind === 'postgres') {
    await db.storedObject.deleteMany({ where: { id: key } });
    return;
  }
  if (kind === 'gcs' && process.env.GCS_BUCKET) {
    await new Storage().bucket(process.env.GCS_BUCKET).file(key).delete({ ignoreNotFound: true });
    return;
  }
  if (kind === 'local') {
    try {
      await unlink(join(process.cwd(), '.data', 'uploads', key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
    return;
  }
  throw new ApiError(503, 'notConfigured');
}

export async function cleanStorage() {
  const jobs = await db.storageDeletionJob.findMany({ orderBy: { createdAt: 'asc' }, take: 20 });
  for (const job of jobs) {
    try {
      await deleteFile(job.storageKey);
      await db.storageDeletionJob.deleteMany({ where: { id: job.id } });
    } catch {
      await db.storageDeletionJob.updateMany({
        where: { id: job.id },
        data: { attempts: { increment: 1 } },
      });
    }
  }
  // A crash between storing a file and inserting its Document must not retain an orphan forever.
  const orphaned = await db.$queryRaw<
    { id: string }[]
  >`SELECT s.id FROM "StoredObject" s WHERE s."createdAt" < ${new Date(Date.now() - 86400000)} AND NOT EXISTS (SELECT 1 FROM "Document" d WHERE d."storageKey" = 'postgres:' || s.id) LIMIT 100`;
  if (orphaned.length)
    await db.storedObject.deleteMany({ where: { id: { in: orphaned.map((f) => f.id) } } });
  await db.identityChallenge.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 86400000) } },
  });
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.rateBucket.deleteMany({ where: { resetsAt: { lt: new Date(Date.now() - 86400000) } } });
}
