import { z } from 'zod';
import { ApiError } from '../errors';
import { checkedFetch } from './http';

function sender() {
  const raw = process.env.EMAIL_FROM || '';
  const match = /^(.*?)\s*<([^<>]+)>$/.exec(raw);
  const email = z.email().safeParse(match ? match[2] : raw);
  return email.success ? { name: match?.[1]?.trim() || 'SAHAAYA', email: email.data } : null;
}
export function emailConfigured() {
  const provider = process.env.EMAIL_PROVIDER || 'resend';
  return Boolean(
    sender() &&
    ((provider === 'brevo' && process.env.BREVO_API_KEY) ||
      (provider === 'resend' && process.env.RESEND_API_KEY)),
  );
}
export async function sendEmail(
  to: string,
  subject: string,
  content: string,
  idempotencyKey: string,
) {
  if (!emailConfigured()) throw new ApiError(503, 'notConfigured');
  if (process.env.EMAIL_PROVIDER === 'brevo') {
    const response = await checkedFetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: sender(),
        to: [{ email: to }],
        subject,
        textContent: content,
        headers: { IdempotencyKey: idempotencyKey },
      }),
    });
    const parsed = z.object({ messageId: z.string().min(1) }).safeParse(await response.json());
    if (!parsed.success) throw new ApiError(502, 'providerError');
    return `brevo:${parsed.data.messageId}`;
  }
  const response = await checkedFetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text: content }),
  });
  const parsed = z.object({ id: z.string().min(1) }).safeParse(await response.json());
  if (!parsed.success) throw new ApiError(502, 'providerError');
  return parsed.data.id;
}
