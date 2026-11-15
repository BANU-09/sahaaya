import { DateTime } from 'luxon';
import { db } from '../db';
import { ROLE_PERMISSIONS, type Role } from '@/lib/permissions';
import { generateSchedule } from '@/lib/schedule';
import { saveFile } from '../integrations/storage';
import { ApiError } from '../errors';
export const DEMO_USERS = {
  PATIENT: 'demo-patient',
  FAMILY: 'demo-family',
  CAREGIVER: 'demo-caregiver',
  DOCTOR: 'demo-doctor',
} as const;
export const SAMPLE_EXTRACTION = {
  doctor: 'Dr. Meera Rao (fictional)',
  date: '2026-11-15',
  medicines: [
    {
      name: 'Metformin',
      strength: '500 mg',
      dosage: '1 tablet',
      frequency: 'Daily',
      duration: null,
      timing: '08:00',
      route: 'Oral',
      instructions: 'After breakfast — fictional demonstration only',
      uncertainFields: ['duration'],
    },
  ],
};
export function samplePdf() {
  const lines = [
    'SAHAAYA - FICTIONAL DEMONSTRATION ONLY',
    'Not a prescription. Not for medical use.',
    'Patient: Lakshmi Devi (fictional)',
    'Doctor: Dr. Meera Rao (fictional)',
    'Metformin | 500 mg | 1 tablet | 08:00',
    'After breakfast. Duration not specified.',
    'Every field requires human verification.',
  ];
  const stream =
    'BT /F1 16 Tf 50 760 Td ' +
    lines.map((line, i) => `${i ? '0 -32 Td ' : ''}(${line}) Tj`).join('\n') +
    '\nET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let content = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(content));
    content += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const offset = Buffer.byteLength(content);
  content += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`;
  return Buffer.from(content);
}
export async function seedDemo(reset = false) {
  if (process.env.DEMO_MODE !== 'true') throw new ApiError(404, 'notFound');
  if (!reset && (await db.patient.findUnique({ where: { id: 'demo-lakshmi' } }))) return;
  const bytes = samplePdf();
  const storageKey = await saveFile(bytes, 'application/pdf');
  await db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(7319282)::text`;
      if (!reset && (await tx.patient.findUnique({ where: { id: 'demo-lakshmi' } }))) return;
      if (reset) {
        await tx.patient.deleteMany({ where: { id: 'demo-lakshmi', demo: true } });
        await tx.notification.deleteMany({ where: { user: { demo: true } } });
      }
      const people: { id: string; name: string; role: Role; relationship: string }[] = [
        { id: 'demo-patient', name: 'Lakshmi Devi', role: 'PATIENT', relationship: 'Self' },
        { id: 'demo-family', name: 'Arjun Rao', role: 'FAMILY_ADMIN', relationship: 'Son' },
        { id: 'demo-family-2', name: 'Ananya Rao', role: 'FAMILY', relationship: 'Daughter' },
        { id: 'demo-caregiver', name: 'Priya Nair', role: 'CAREGIVER', relationship: 'Caregiver' },
        { id: 'demo-doctor', name: 'Dr. Meera Rao', role: 'DOCTOR', relationship: 'Doctor' },
      ];
      for (const person of people)
        await tx.user.upsert({
          where: { id: person.id },
          create: {
            id: person.id,
            name: person.name,
            email: `${person.id}@example.invalid`,
            demo: true,
            preferences: { create: {} },
          },
          update: {},
        });
      await tx.doctor.upsert({
        where: { userId: 'demo-doctor' },
        create: {
          userId: 'demo-doctor',
          specialty: 'General medicine (demo)',
          hospital: 'Lotus Care (fictional)',
          verifiedAt: new Date(),
        },
        update: {},
      });
      await tx.caregiver.upsert({
        where: { userId: 'demo-caregiver' },
        create: { userId: 'demo-caregiver' },
        update: {},
      });
      const patient = await tx.patient.create({
        data: {
          id: 'demo-lakshmi',
          ownerId: 'demo-patient',
          name: 'Lakshmi Devi',
          dob: new Date('1958-04-12'),
          bloodGroup: 'O+',
          allergies: ['Penicillin (fictional record)'],
          conditions: ['Type 2 diabetes (fictional)', 'Hypertension (fictional)'],
          emergencyName: 'Arjun Rao',
          hospital: 'Lotus Care Hospital (fictional)',
          primaryDoctor: 'Dr. Meera Rao (fictional)',
          demo: true,
          circle: { create: {} },
        },
        include: { circle: true },
      });
      for (const person of people)
        await tx.membership.create({
          data: {
            circleId: patient.circle!.id,
            userId: person.id,
            role: person.role,
            relationship: person.relationship,
            consentedAt: new Date(),
            permissions: { create: ROLE_PERMISSIONS[person.role].map((key) => ({ key })) },
          },
        });
      const day = DateTime.now().setZone('Asia/Kolkata').startOf('day');
      for (const [i, medicine] of [
        {
          name: 'Metformin',
          strength: '500 mg',
          times: ['08:00'],
          instructions: 'After breakfast',
        },
        {
          name: 'Amlodipine',
          strength: '5 mg',
          times: ['13:00'],
          instructions: 'As written in the original prescription',
        },
        { name: 'Vitamin D3', strength: '1000 IU', times: ['20:00'], instructions: 'After dinner' },
      ].entries()) {
        const schedule = {
          frequency: 'DAILY',
          times: medicine.times,
          weekdays: [],
          startDate: day.minus({ days: 6 }).toISODate()!,
          endDate: null,
          timezone: 'Asia/Kolkata',
        };
        const med = await tx.medication.create({
          data: {
            patientId: 'demo-lakshmi',
            name: medicine.name,
            strength: medicine.strength,
            dosage: '1 tablet',
            instructions: medicine.instructions + ' · fictional demo',
            doctor: 'Dr. Meera Rao (fictional)',
            initialStock: 30,
            status: 'ACTIVE',
            approvedBy: 'demo-patient',
            approvedAt: day.minus({ days: 6 }).toJSDate(),
            schedule: { create: schedule },
          },
        });
        const dates = generateSchedule(schedule, day.minus({ days: 6 }).toJSDate(), 14);
        for (const [j, date] of dates.entries()) {
          const past = date < day.toJSDate() || (i === 0 && date < new Date());
          const status = past ? (j === 3 && i === 1 ? 'NOT_TAKEN' : 'TAKEN') : 'PENDING';
          await tx.scheduledDose.create({
            data: {
              medicationId: med.id,
              patientId: 'demo-lakshmi',
              scheduledAt: date,
              status,
              confirmedAt: past ? new Date(date.getTime() + 3 * 60000) : null,
              ...(past
                ? { events: { create: { actorId: 'demo-patient', source: 'SELF', status } } }
                : {}),
            },
          });
        }
      }
      await tx.appointment.create({
        data: {
          patientId: 'demo-lakshmi',
          doctor: 'Dr. Meera Rao',
          specialty: 'General medicine',
          hospital: 'Lotus Care Hospital (fictional)',
          location: 'Hyderabad',
          startsAt: day.plus({ days: 2, hours: 10, minutes: 30 }).toJSDate(),
          purpose: 'Routine follow-up · fictional demo',
          type: 'IN_PERSON',
          preparation: 'Bring the original prescription and recent reports.',
          reports: [],
          status: 'REQUESTED',
        },
      });
      await tx.careTask.create({
        data: {
          patientId: 'demo-lakshmi',
          title: 'Evening check-in',
          note: 'Ask how the day went · fictional demo',
          assignedTo: 'demo-family',
          dueAt: day.plus({ hours: 18 }).toJSDate(),
          createdBy: 'demo-patient',
        },
      });
      await tx.journalEntry.create({
        data: {
          patientId: 'demo-lakshmi',
          mood: 'GOOD',
          note: 'Enjoyed a quiet morning in the garden. (Fictional)',
          actorId: 'demo-patient',
        },
      });
      await tx.document.create({
        data: {
          patientId: 'demo-lakshmi',
          title: 'Sample prescription · fictional',
          category: 'prescription',
          mimeType: 'application/pdf',
          size: bytes.length,
          storageKey,
          uploadedBy: 'demo-patient',
        },
      });
      await tx.auditLog.create({
        data: {
          patientId: 'demo-lakshmi',
          actorId: 'demo-patient',
          actorName: 'Lakshmi Devi',
          action: 'demoReset',
        },
      });
    },
    { timeout: 60000 },
  );
}
