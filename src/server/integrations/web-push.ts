import * as webpush from 'web-push';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { ApiError } from '../errors';

export const webPushSubscription = z.object({
  endpoint: z
    .url()
    .max(2048)
    .refine((endpoint) => {
      const url = new URL(endpoint);
      const host = url.hostname;
      return (
        url.protocol === 'https:' &&
        !url.port &&
        !url.username &&
        !url.password &&
        (host === 'fcm.googleapis.com' ||
          host === 'web.push.apple.com' ||
          host.endsWith('.push.services.mozilla.com') ||
          host.endsWith('.notify.windows.com'))
      );
    }),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}={0,1}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{22}={0,2}$/),
  }),
});

export async function sendWebPush(
  token: string,
  title: string,
  body: string,
  notificationId: string,
) {
  const subscription = webPushSubscription.parse(JSON.parse(token.slice('webpush:'.length)));
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.APP_URL)
    throw new ApiError(503, 'notConfigured');
  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({ notification: { title, body }, notificationId }),
      {
        vapidDetails: {
          subject: process.env.APP_URL,
          publicKey: process.env.VAPID_PUBLIC_KEY,
          privateKey: process.env.VAPID_PRIVATE_KEY,
        },
        TTL: 3600,
        timeout: 10000,
        topic: createHash('sha256').update(notificationId).digest('base64url').slice(0, 32),
      },
    );
    return `webpush:${notificationId}`;
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'statusCode' in error &&
      (error.statusCode === 404 || error.statusCode === 410)
    )
      throw new ApiError(410, 'pushExpired');
    throw new ApiError(502, 'providerError');
  }
}
