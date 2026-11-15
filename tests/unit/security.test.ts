import { describe, it, expect } from 'vitest';
import { canAccess, ROLE_PERMISSIONS } from '@/lib/permissions';
import { hashSecret, verifySecret, encrypt, decrypt, digest, token } from '@/server/crypto';
import {
  registrationSchema,
  medicationSchema,
  appointmentSchema,
  invitationSchema,
  doseSchema,
} from '@/lib/validation';
describe('least privilege', () => {
  it('denies revoked memberships', () =>
    expect(canAccess(ROLE_PERMISSIONS.PATIENT, 'medications.view', true)).toBe(false));
  it('does not give family members dose confirmation or prescription approval', () => {
    expect(canAccess(ROLE_PERMISSIONS.FAMILY, 'doses.confirm')).toBe(false);
    expect(canAccess(ROLE_PERMISSIONS.FAMILY_ADMIN, 'prescriptions.approve')).toBe(false);
  });
  it('permits caregiver confirmation but not prescription changes', () => {
    expect(canAccess(ROLE_PERMISSIONS.CAREGIVER, 'doses.confirm')).toBe(true);
    expect(canAccess(ROLE_PERMISSIONS.CAREGIVER, 'medications.edit')).toBe(false);
  });
  it('does not let verified doctors approve prescriptions by default', () =>
    expect(canAccess(ROLE_PERMISSIONS.DOCTOR, 'prescriptions.approve')).toBe(false));
});
describe('credentials and token encryption', () => {
  it('salts hashes and rejects wrong or absent secrets', async () => {
    const first = await hashSecret('a secure test password'),
      second = await hashSecret('a secure test password');
    expect(first).not.toBe(second);
    expect(first).not.toContain('a secure test');
    expect(await verifySecret('a secure test password', first)).toBe(true);
    expect(await verifySecret('wrong', first)).toBe(false);
    expect(await verifySecret('anything', null)).toBe(false);
  });
  it('hashes opaque random tokens', () => {
    expect(token()).not.toBe(token());
    expect(digest(token())).toMatch(/^[a-f0-9]{64}$/);
  });
  it('uses authenticated encryption and rejects tampering', () => {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    const encrypted = encrypt('refresh-token');
    expect(encrypted).not.toContain('refresh-token');
    expect(decrypt(encrypted)).toBe('refresh-token');
    const parts = encrypted.split('.');
    parts[1] = Buffer.alloc(16, 0).toString('base64url');
    expect(() => decrypt(parts.join('.'))).toThrow();
  });
  it('rejects missing encryption keys', () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(() => encrypt('secret')).toThrow();
  });
});
describe('request validation', () => {
  const patient = {
    name: 'Example',
    email: 'test@example.invalid',
    password: 'a secure test password',
    consent: true,
  };
  it('requires patient consent and forbids doctor self registration', () => {
    expect(registrationSchema.safeParse({ ...patient, consent: false }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...patient, role: 'DOCTOR' }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...patient, role: 'ADMIN' }).success).toBe(false);
  });
  it('allows mobile-only patients but requires an identifier', () => {
    expect(
      registrationSchema.safeParse({ ...patient, email: undefined, mobile: '+919999999999' })
        .success,
    ).toBe(true);
    expect(registrationSchema.safeParse({ ...patient, email: undefined }).success).toBe(false);
  });
  it('enforces six-digit optional PINs', () => {
    expect(registrationSchema.safeParse({ ...patient, pin: '1234' }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...patient, pin: '124789' }).success).toBe(true);
  });
  it('requires a valid nonempty scheduled time and ordered course dates', () => {
    const medication = {
      name: 'Example',
      strength: '5 mg',
      dosage: '1 tablet',
      instructions: 'As prescribed',
      doctor: 'Dr Example',
      initialStock: 10,
      schedule: {
        frequency: 'DAILY',
        times: [],
        weekdays: [],
        startDate: '2026-11-15',
        endDate: null,
        timezone: 'Asia/Kolkata',
      },
    };
    expect(medicationSchema.safeParse(medication).success).toBe(false);
    expect(
      medicationSchema.safeParse({
        ...medication,
        schedule: { ...medication.schedule, times: ['25:00'] },
      }).success,
    ).toBe(false);
    expect(
      medicationSchema.safeParse({
        ...medication,
        schedule: { ...medication.schedule, times: ['08:00'], endDate: '2026-11-14' },
      }).success,
    ).toBe(false);
    expect(
      medicationSchema.safeParse({
        ...medication,
        schedule: { ...medication.schedule, times: ['08:00'] },
      }).success,
    ).toBe(true);
  });
  it('requires a weekday for a weekday schedule', () => {
    const data = {
      name: 'X',
      strength: '5 mg',
      dosage: '1',
      instructions: 'X',
      doctor: 'X',
      initialStock: 1,
      schedule: {
        frequency: 'WEEKDAYS',
        times: ['08:00'],
        weekdays: [],
        startDate: '2026-11-15',
        timezone: 'UTC',
      },
    };
    expect(medicationSchema.safeParse(data).success).toBe(false);
  });
  it('rejects non-calendar dates', () =>
    expect(registrationSchema.safeParse({ ...patient, dob: '2026-02-31' }).success).toBe(false));
  it('does not accept invented appointment confirmation status in create', () => {
    const result = appointmentSchema.parse({
      doctor: 'X',
      specialty: 'X',
      hospital: 'X',
      startsAt: '2026-11-15T12:00:00Z',
      purpose: 'X',
      status: 'CONFIRMED',
    });
    expect(result).not.toHaveProperty('status');
  });
  it('rejects unsupported roles and permissions in invitations', () =>
    expect(
      invitationSchema.safeParse({
        email: 'x@example.invalid',
        role: 'PATIENT',
        relationship: 'X',
        permissions: ['admin.all'],
      }).success,
    ).toBe(false));
  it('rejects invented dose states', () =>
    expect(doseSchema.safeParse({ action: 'MISSED' }).success).toBe(false));
});
