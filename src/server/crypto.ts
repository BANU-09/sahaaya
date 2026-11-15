import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  createHash,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
export const token = () => randomBytes(32).toString('base64url');
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export async function hashSecret(secret: string) {
  const salt = randomBytes(16).toString('hex');
  const key = (await derive(secret, salt, 64)) as Buffer;
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function verifySecret(secret: string, stored: string | null) {
  const [, salt, encoded] = (stored ?? '').split(':');
  const key = (await derive(secret, salt || 'missing-account-dummy-salt', 64)) as Buffer;
  const expected = Buffer.from(encoded || '00'.repeat(64), 'hex');
  return Boolean(stored) && expected.length === key.length && timingSafeEqual(expected, key);
}
function encryptionKey() {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY || '', 'base64');
  if (key.length !== 32) throw new Error('Token encryption key must be 32 bytes');
  return key;
}
export function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((v) => v.toString('base64url')).join('.');
}
export function decrypt(value: string) {
  const [iv, tag, data] = value.split('.').map((v) => Buffer.from(v, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
