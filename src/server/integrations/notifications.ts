import { checkedFetch, googleToken } from './google';
import { ApiError } from '../errors';
import { sendWebPush } from './web-push';
export async function sendEmail(
  to: string,
  subject: string,
  content: string,
  idempotencyKey: string,
) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    throw new ApiError(503, 'notConfigured');
  const response = await checkedFetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text: content }),
  });
  const body = (await response.json()) as { id?: string };
  if (!body.id) throw new ApiError(502, 'providerError');
  return body.id;
}
export async function sendPush(
  deviceToken: string,
  title: string,
  body: string,
  notificationId: string,
) {
  if (deviceToken.startsWith('webpush:'))
    return sendWebPush(deviceToken, title, body, notificationId);
  if (!process.env.FIREBASE_PROJECT_ID) throw new ApiError(503, 'notConfigured');
  const accessToken = await googleToken();
  const response = await checkedFetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(process.env.FIREBASE_PROJECT_ID)}/messages:send`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          notification: { title, body },
          webpush: { fcm_options: { link: `${process.env.APP_URL}/app/notifications` } },
        },
      }),
    },
  );
  const data = (await response.json()) as { name?: string };
  if (!data.name) throw new ApiError(502, 'providerError');
  return data.name;
}
