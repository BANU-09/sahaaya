import { it, expect } from 'vitest';
import { webPushSubscription } from '@/server/integrations/web-push';
const keys = { p256dh: 'A'.repeat(87), auth: 'B'.repeat(22) };
it('accepts a browser push endpoint with subscription keys', () => {
  expect(
    webPushSubscription.safeParse({ endpoint: 'https://fcm.googleapis.com/fcm/send/fixture', keys })
      .success,
  ).toBe(true);
});
it.each([
  'http://fcm.googleapis.com/x',
  'https://fcm.googleapis.com.evil.test/x',
  'https://127.0.0.1/x',
  'https://user@fcm.googleapis.com/x',
  'https://fcm.googleapis.com:8443/x',
])('rejects an unsafe push destination %s', (endpoint) => {
  expect(webPushSubscription.safeParse({ endpoint, keys }).success).toBe(false);
});
it('rejects malformed encryption keys', () => {
  expect(
    webPushSubscription.safeParse({
      endpoint: 'https://fcm.googleapis.com/x',
      keys: { ...keys, auth: 'invalid' },
    }).success,
  ).toBe(false);
});
