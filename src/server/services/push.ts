import type { User } from '@prisma/client';
import { db } from '../db';
import { rateLimit } from '../auth';
import { ApiError } from '../errors';
import { token } from '../crypto';
import { sendPush } from '../integrations/notifications';
import { getText } from '@/lib/i18n';

/** A self-test sends only a generic message to this account's most recent device. */
export async function testPush(user: User) {
  if (user.demo) throw new ApiError(403, 'forbidden');
  await rateLimit(`push-test:${user.id}`, 2);
  const device = await db.pushSubscription.findFirst({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
  });
  if (!device) throw new ApiError(400, 'permissionRequired');
  const item = await db.notification.create({
    data: {
      userId: user.id,
      key: 'testNotification',
      eventKey: `push-test:${user.id}:${token()}`,
      channel: 'PUSH',
      status: 'PROCESSING',
      attempts: 1,
      dueAt: new Date(Date.now() + 5 * 60_000),
    },
  });
  try {
    const providerId = await sendPush(
      device.token,
      'SAHAAYA',
      getText(user.language, 'testNotification'),
      item.id,
    );
    await db.notification.update({
      where: { id: item.id },
      data: { providerId, acceptedAt: new Date() },
    });
    // A browser receipt can arrive before the provider responds: never downgrade DELIVERED.
    await db.notification.updateMany({
      where: { id: item.id, status: 'PROCESSING' },
      data: { status: 'ACCEPTED' },
    });
    return { message: 'deliveryAccepted', id: item.id };
  } catch (error) {
    await db.notification.updateMany({
      where: { id: item.id, status: 'PROCESSING' },
      data: {
        status: 'FAILED',
        errorCode: error instanceof ApiError ? error.code : 'providerError',
      },
    });
    if (error instanceof ApiError && error.code === 'pushExpired')
      await db.pushSubscription.deleteMany({ where: { id: device.id, userId: user.id } });
    throw error;
  }
}
