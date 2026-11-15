import { Webhook } from 'svix';
import { z } from 'zod';
import { db } from '../db';
import { ApiError, readText } from '../errors';

export async function emailWebhook(request: Request) {
  if (!process.env.RESEND_WEBHOOK_SECRET) throw new ApiError(503, 'notConfigured');
  const raw = await readText(request, 65536);
  const eventId = request.headers.get('svix-id') || '';
  let verified: unknown;
  try {
    verified = new Webhook(process.env.RESEND_WEBHOOK_SECRET).verify(raw, {
      'svix-id': eventId,
      'svix-timestamp': request.headers.get('svix-timestamp') || '',
      'svix-signature': request.headers.get('svix-signature') || '',
    });
  } catch {
    throw new ApiError(401, 'unauthorized');
  }
  const event = z
    .object({ type: z.string(), data: z.object({ email_id: z.string() }) })
    .parse(verified);
  const statuses: Record<string, string> = {
    'email.delivered': 'DELIVERED',
    'email.bounced': 'BOUNCED',
    'email.complained': 'COMPLAINED',
    'email.failed': 'FAILED',
  };
  const status = statuses[event.type];
  if (!status) return { received: true };
  await db.$transaction(async (tx) => {
    // Serialize retries and out-of-order events for this provider message.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${event.data.email_id}))::text`;
    if (
      await tx.webhookReceipt.findUnique({
        where: { provider_eventId: { provider: 'RESEND', eventId } },
      })
    )
      return;
    const item = await tx.notification.findFirst({
      where: { providerId: event.data.email_id, channel: 'EMAIL' },
    });
    // An event may arrive before the send response has been stored. Ask the provider to retry.
    if (!item) throw new ApiError(503, 'retryLater');
    const rank: Record<string, number> = { DELIVERED: 1, FAILED: 2, BOUNCED: 3, COMPLAINED: 4 };
    if ((rank[status] || 0) >= (rank[item.status] || 0)) {
      await tx.notification.update({
        where: { id: item.id },
        data: {
          status,
          ...(status === 'DELIVERED'
            ? { deliveredAt: new Date(), errorCode: null }
            : { errorCode: status }),
        },
      });
    }
    await tx.webhookReceipt.create({ data: { provider: 'RESEND', eventId } });
  });
  return { received: true };
}
