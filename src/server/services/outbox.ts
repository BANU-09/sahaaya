import type { Prisma } from '@prisma/client';
export function notificationPermission(key: string) {
  if (['appointments', 'appointmentUpdated'].includes(key)) return 'appointments.manage';
  if (key === 'documentUploaded') return 'records.view';
  if (key === 'prescriptionReview') return 'prescriptions.approve';
  if (key === 'taskAssigned') return 'tasks.manage';
  return 'medications.view';
}
export async function queueCareUpdate(
  client: Prisma.TransactionClient,
  patientId: string,
  key: string,
  event: string,
  onlyCaregivers = false,
  targetUserId?: string,
) {
  const members = await client.membership.findMany({
    where: {
      circle: { patientId },
      revokedAt: null,
      ...(targetUserId ? { userId: targetUserId } : {}),
      ...(onlyCaregivers ? { role: { in: ['CAREGIVER', 'FAMILY_ADMIN', 'FAMILY'] } } : {}),
      permissions: { some: { key: notificationPermission(key) } },
    },
    include: { user: { include: { preferences: true } } },
  });
  for (const member of members) {
    const channels = [
      'IN_APP',
      ...(member.user.preferences?.email ? ['EMAIL'] : []),
      ...(member.user.preferences?.push ? ['PUSH'] : []),
    ];
    for (const channel of channels)
      await client.notification.upsert({
        where: { eventKey: `${event}:${member.userId}:${channel}` },
        create: {
          userId: member.userId,
          patientId,
          key,
          eventKey: `${event}:${member.userId}:${channel}`,
          channel,
          status: channel === 'IN_APP' ? 'AVAILABLE' : 'QUEUED',
        },
        update: {},
      });
  }
}
