import { beforeEach, expect, it, vi } from 'vitest';
import type { User } from '@prisma/client';
const mocks = vi.hoisted(() => ({
  db: {
    pushSubscription: { findFirst: vi.fn(), deleteMany: vi.fn() },
    notification: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
  rateLimit: vi.fn(),
  sendPush: vi.fn(),
}));
vi.mock('@/server/db', () => ({ db: mocks.db }));
vi.mock('@/server/auth', () => ({ rateLimit: mocks.rateLimit }));
vi.mock('@/server/integrations/notifications', () => ({ sendPush: mocks.sendPush }));
import { testPush } from '@/server/services/push';
import { ApiError } from '@/server/errors';
const user = { id: 'owner', demo: false, language: 'en' } as User;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.db.pushSubscription.findFirst.mockResolvedValue({ id: 'device', token: 'fixture-token' });
  mocks.db.notification.create.mockResolvedValue({ id: 'notification' });
  mocks.db.notification.updateMany.mockResolvedValue({ count: 1 });
  mocks.sendPush.mockResolvedValue('provider-id');
});
it('never sends from a shared demo account', async () => {
  await expect(testPush({ ...user, demo: true })).rejects.toMatchObject({ status: 403 });
  expect(mocks.sendPush).not.toHaveBeenCalled();
});
it('requires a device owned by the authenticated user', async () => {
  mocks.db.pushSubscription.findFirst.mockResolvedValue(null);
  await expect(testPush(user)).rejects.toMatchObject({ code: 'permissionRequired' });
  expect(mocks.db.pushSubscription.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({ where: { userId: 'owner' } }),
  );
  expect(mocks.db.notification.create).not.toHaveBeenCalled();
});
it('records acceptance without overwriting a receipt that arrived first', async () => {
  const before = Date.now();
  expect(await testPush(user)).toEqual({ id: 'notification', message: 'deliveryAccepted' });
  expect(mocks.rateLimit).toHaveBeenCalledWith('push-test:owner', 2);
  expect(mocks.db.notification.create.mock.calls[0][0].data.dueAt.getTime()).toBeGreaterThanOrEqual(
    before + 5 * 60_000,
  );
  expect(mocks.db.notification.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ providerId: 'provider-id' }) }),
  );
  expect(mocks.db.notification.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: 'notification', status: 'PROCESSING' },
      data: expect.objectContaining({ status: 'ACCEPTED' }),
    }),
  );
});
it('removes only an expired device and records the failed attempt', async () => {
  mocks.sendPush.mockRejectedValue(new ApiError(410, 'pushExpired'));
  await expect(testPush(user)).rejects.toMatchObject({ code: 'pushExpired' });
  expect(mocks.db.pushSubscription.deleteMany).toHaveBeenCalledWith({
    where: { id: 'device', userId: 'owner' },
  });
  expect(mocks.db.notification.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({ data: { status: 'FAILED', errorCode: 'pushExpired' } }),
  );
});
it('does not remove a valid subscription on a temporary provider error', async () => {
  mocks.sendPush.mockRejectedValue(new Error('temporary network failure'));
  await expect(testPush(user)).rejects.toThrow('temporary network failure');
  expect(mocks.db.pushSubscription.deleteMany).not.toHaveBeenCalled();
});
