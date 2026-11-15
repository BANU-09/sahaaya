import { db } from '../db';
import { generateSchedule } from '@/lib/schedule';
import type { Prisma } from '@prisma/client';
export async function generateDoses(
  medicationId: string,
  client: Prisma.TransactionClient = db,
  from = new Date(),
) {
  const medication = await client.medication.findUnique({
    where: { id: medicationId },
    include: { schedule: true },
  });
  if (!medication || medication.status !== 'ACTIVE' || !medication.schedule) return;
  const dates = generateSchedule(medication.schedule, from);
  await client.scheduledDose.createMany({
    data: dates
      .filter((scheduledAt) => scheduledAt >= (medication.approvedAt || from))
      .map((scheduledAt) => ({ medicationId, patientId: medication.patientId, scheduledAt })),
    skipDuplicates: true,
  });
}
