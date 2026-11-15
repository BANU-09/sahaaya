import { z } from 'zod';
import { DateTime } from 'luxon';
import { PERMISSIONS, ROLES } from './permissions';
import { DOSE_ACTIONS } from './schedule';
export const languages = ['en', 'te', 'ta', 'hi', 'kn', 'ml'] as const;
export const text = z.string().trim().min(1).max(300);
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => DateTime.fromISO(v).isValid);
export const timezone = z.string().refine((v) => DateTime.now().setZone(v).isValid);
export const password = z.string().min(12).max(128);
export const registrationSchema = z
  .object({
    name: text,
    email: z.email().toLowerCase().optional(),
    mobile: z
      .string()
      .regex(/^\+?[0-9]{8,15}$/)
      .optional(),
    password,
    language: z.enum(languages).default('en'),
    timezone: timezone.default('Asia/Kolkata'),
    role: z.enum(['PATIENT', 'FAMILY', 'CAREGIVER']).default('PATIENT'),
    dob: dateOnly.optional(),
    pin: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
    emergencyName: text.optional(),
    emergencyPhone: z.string().max(20).optional(),
    easyMode: z.boolean().default(false),
    consent: z.literal(true),
  })
  .refine((v) => Boolean(v.email || v.mobile), { message: 'Email or mobile required' });
export const loginSchema = z.object({ identity: text, password: z.string().max(128) });
export const scheduleSchema = z
  .object({
    frequency: z.enum(['DAILY', 'WEEKDAYS', 'ALTERNATE', 'PRN']),
    times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).max(8),
    weekdays: z.array(z.number().int().min(1).max(7)).max(7).default([]),
    startDate: dateOnly,
    endDate: dateOnly.nullable().default(null),
    timezone,
  })
  .refine((v) => v.frequency === 'PRN' || v.times.length > 0)
  .refine((v) => v.frequency !== 'WEEKDAYS' || v.weekdays.length > 0)
  .refine((v) => !v.endDate || v.endDate >= v.startDate);
export const medicationSchema = z.object({
  name: text,
  strength: text,
  dosage: text,
  unitsPerDose: z.number().positive().max(100).default(1),
  route: text.default('Oral'),
  instructions: z.string().max(1000),
  doctor: text,
  initialStock: z.number().min(0).max(100000),
  expiryDate: dateOnly.optional(),
  schedule: scheduleSchema,
  prescriptionId: z.string().optional(),
});
export const doseSchema = z.object({
  action: z.enum(DOSE_ACTIONS),
  reason: z.string().max(500).optional(),
  witnessed: z.boolean().default(false),
});
export const appointmentSchema = z.object({
  doctor: text,
  specialty: text,
  hospital: text,
  location: z.string().max(300).default(''),
  contact: z.string().max(100).optional(),
  startsAt: z.iso.datetime({ offset: true }),
  purpose: text,
  type: z.enum(['IN_PERSON', 'VIDEO', 'PHONE']).default('IN_PERSON'),
  preparation: z.string().max(2000).default(''),
  reports: z.array(text).max(20).default([]),
});
export const invitationSchema = z.object({
  email: z.email().toLowerCase(),
  role: z.enum(ROLES).exclude(['PATIENT']),
  relationship: text,
  permissions: z.array(z.enum(PERMISSIONS)).min(1).max(PERMISSIONS.length),
});
export const journalSchema = z.object({
  mood: z.enum(['VERY_GOOD', 'GOOD', 'UNWELL', 'HELP']),
  note: z.string().max(2000).default(''),
});
export const taskSchema = z.object({
  title: text,
  note: z.string().max(2000).default(''),
  assignedTo: z.string().optional(),
  dueAt: z.iso.datetime({ offset: true }),
});
export const extractedSchema = z.object({
  doctor: z.string().max(300).nullable(),
  date: z.string().max(20).nullable(),
  medicines: z
    .array(
      z.object({
        name: z.string().max(200).nullable(),
        strength: z.string().max(100).nullable(),
        dosage: z.string().max(200).nullable(),
        frequency: z.string().max(100).nullable(),
        duration: z.string().max(100).nullable(),
        timing: z.string().max(100).nullable(),
        route: z.string().max(100).nullable(),
        instructions: z.string().max(500).nullable(),
        uncertainFields: z.array(z.string()).max(20),
      }),
    )
    .max(30),
});
