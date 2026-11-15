export const PERMISSIONS = [
  'profile.view',
  'medications.view',
  'medications.edit',
  'prescriptions.approve',
  'doses.confirm',
  'appointments.manage',
  'records.view',
  'records.upload',
  'journal.view',
  'journal.write',
  'tasks.manage',
  'emergency.view',
  'family.manage',
  'audit.view',
] as const;
export type Permission = (typeof PERMISSIONS)[number];
export const ROLES = ['PATIENT', 'FAMILY_ADMIN', 'FAMILY', 'CAREGIVER', 'DOCTOR'] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  PATIENT: PERMISSIONS,
  FAMILY_ADMIN: [
    'profile.view',
    'medications.view',
    'medications.edit',
    'appointments.manage',
    'records.view',
    'records.upload',
    'journal.view',
    'tasks.manage',
    'emergency.view',
    'audit.view',
  ],
  FAMILY: [
    'profile.view',
    'medications.view',
    'appointments.manage',
    'tasks.manage',
    'emergency.view',
  ],
  CAREGIVER: [
    'profile.view',
    'medications.view',
    'doses.confirm',
    'journal.view',
    'journal.write',
    'tasks.manage',
    'emergency.view',
  ],
  DOCTOR: [
    'profile.view',
    'medications.view',
    'records.view',
    'journal.view',
    'appointments.manage',
  ],
};
export function canAccess(keys: readonly string[], permission: Permission, revoked = false) {
  return !revoked && keys.includes(permission);
}
