import { expect, it, vi } from 'vitest';
const { fake, sendPush } = vi.hoisted(() => ({
  fake: {
    notification: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    membership: { findFirst: vi.fn() },
    doctor: { findFirst: vi.fn() },
  },
  sendPush: vi.fn(),
}));
vi.mock('@/server/db', () => ({ db: fake }));
vi.mock('@/server/integrations/notifications', () => ({ sendPush, sendEmail: vi.fn() }));
import { dispatchNotifications } from '@/server/services/worker';
it('does not deliver to a doctor whose professional verification was revoked', async () => {
  fake.notification.findMany.mockResolvedValue([
    {
      id: 'fixture',
      userId: 'doctor',
      patientId: 'patient',
      key: 'DUE',
      channel: 'PUSH',
      user: { demo: false, preferences: { push: true } },
    },
  ]);
  fake.membership.findFirst.mockResolvedValue({ role: 'DOCTOR' });
  fake.doctor.findFirst.mockResolvedValue(null);
  await dispatchNotifications();
  expect(sendPush).not.toHaveBeenCalled();
  expect(fake.notification.update).toHaveBeenCalledWith({
    where: { id: 'fixture' },
    data: { status: 'SKIPPED', errorCode: 'ACCESS_REVOKED' },
  });
});
