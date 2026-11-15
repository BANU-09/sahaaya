import { z } from 'zod';
import type { User } from '@prisma/client';
import { db } from '../db';
import { reauthenticate } from './security';
import { ApiError } from '../errors';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, publicUser } from '../auth';

export async function privacyAction(user: User, action: string, body: unknown) {
  if (user.demo) throw new ApiError(403, 'forbidden');
  await reauthenticate(user, body);
  if (action === 'export') {
    const patient = await db.patient.findUnique({
      where: { ownerId: user.id },
      include: {
        medications: { include: { schedule: true, refills: true } },
        appointments: true,
        documents: {
          select: {
            id: true,
            title: true,
            category: true,
            notes: true,
            mimeType: true,
            createdAt: true,
            revisions: true,
            extractions: true,
          },
        },
        journal: true,
        vitals: true,
        tasks: true,
        handovers: true,
        prescriptions: true,
        summaries: true,
        doses: { include: { events: true } },
        audit: true,
      },
    });
    return {
      exportedAt: new Date(),
      user: publicUser(user),
      patient,
      note: 'Original files can be downloaded from Records while your account is active. Shared patients owned by others are not included.',
    };
  }
  if (action === 'delete') {
    const { confirmation } = z.object({ confirmation: z.literal('DELETE MY ACCOUNT') }).parse(body);
    if (!confirmation) throw new ApiError(400, 'invalidInput');
    await db.$transaction(async (tx) => {
      const patient = await tx.patient.findUnique({
        where: { ownerId: user.id },
        include: { documents: { select: { storageKey: true } } },
      });
      if (patient) {
        await tx.storageDeletionJob.createMany({
          data: patient.documents.map((d) => ({ storageKey: d.storageKey })),
          skipDuplicates: true,
        });
        // Notification patient IDs are intentionally nullable and not foreign keys.
        await tx.notification.deleteMany({ where: { patientId: patient.id } });
      }
      await tx.auditLog.updateMany({
        where: { actorId: user.id },
        data: { actorName: 'Deleted account' },
      });
      await tx.user.delete({ where: { id: user.id } });
    });
    (await cookies()).delete(SESSION_COOKIE);
    return { message: 'saved' };
  }
  throw new ApiError(404, 'notFound');
}
