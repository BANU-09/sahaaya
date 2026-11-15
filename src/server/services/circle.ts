import type { User } from '@prisma/client';
import { db } from '../db';
import { authorize, audit } from '../auth';
import { ApiError } from '../errors';
import { digest, token } from '../crypto';
import { invitationSchema } from '@/lib/validation';
export async function inviteMember(user: User, patientId: string, body: unknown) {
  const data = invitationSchema.parse(body);
  const value = token();
  const result = await db.$transaction(async (tx) => {
    const member = await authorize(user, patientId, 'family.manage', tx);
    if (member.role !== 'PATIENT') throw new ApiError(403, 'patientConsentRequired');
    const invite = await tx.invitation.create({
      data: {
        ...data,
        circleId: member.circleId,
        tokenHash: digest(value),
        createdBy: user.id,
        expiresAt: new Date(Date.now() + 48 * 3600_000),
      },
    });
    await audit(patientId, user, 'invitationCreated', invite.id, tx);
    return invite;
  });
  return {
    id: result.id,
    url: `${process.env.APP_URL}/invite?token=${value}`,
    expiresAt: result.expiresAt,
  };
}
export async function acceptInvitation(user: User, value: string) {
  return db.$transaction(async (tx) => {
    const invite = await tx.invitation.findUnique({
      where: { tokenHash: digest(value) },
      include: { circle: { include: { patient: true } } },
    });
    if (
      !invite ||
      invite.acceptedAt ||
      invite.revokedAt ||
      invite.expiresAt < new Date() ||
      user.email !== invite.email ||
      user.demo !== invite.circle.patient.demo
    )
      throw new ApiError(403, 'invalidInvitation');
    if (
      invite.role === 'DOCTOR' &&
      !(await tx.doctor.findUnique({ where: { userId: user.id } }))?.verifiedAt
    )
      throw new ApiError(403, 'doctorVerificationRequired');
    const changed = await tx.invitation.updateMany({
      where: { id: invite.id, acceptedAt: null, revokedAt: null },
      data: { acceptedAt: new Date() },
    });
    if (!changed.count) throw new ApiError(409, 'conflict');
    const old = await tx.membership.findUnique({
      where: { circleId_userId: { circleId: invite.circleId, userId: user.id } },
    });
    if (old) await tx.membership.delete({ where: { id: old.id } });
    const member = await tx.membership.create({
      data: {
        circleId: invite.circleId,
        userId: user.id,
        role: invite.role,
        relationship: invite.relationship,
        consentedAt: new Date(),
        permissions: { create: invite.permissions.map((key) => ({ key })) },
      },
    });
    await audit(invite.circle.patientId, user, 'invitationAccepted', member.id, tx);
    return { patientId: invite.circle.patientId };
  });
}
