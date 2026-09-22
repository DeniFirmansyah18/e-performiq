import type { UserRole } from '@/types';
import { ForbiddenError } from './errors';
import type { SessionPayload } from './session';

export type Permission =
  | 'kpi:read'
  | 'kpi:write'
  | 'kpi:approve'
  | 'appraisal:calculate'
  | 'appraisal:calibrate'
  | 'audit:read';

/** Satu matriks deklaratif, bukan `if` tersebar di 18 route (spec §6.2). */
const MATRIX: Record<Permission, ReadonlyArray<UserRole>> = {
  'kpi:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE', 'AUDITOR', 'ASSESSOR'],
  'kpi:write': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
  'kpi:approve': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER'],
  'appraisal:calculate': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER', 'ASSESSOR'],
  'appraisal:calibrate': ['SUPER_ADMIN', 'HR_MANAGER', 'BOD', 'ASSESSOR'],
  'audit:read': ['SUPER_ADMIN', 'AUDITOR'],
};

export function can(role: UserRole, permission: Permission): boolean {
  return MATRIX[permission].includes(role);
}

export function assertCan(session: SessionPayload, permission: Permission): void {
  if (!can(session.role, permission)) {
    throw new ForbiddenError(
      `Peran '${session.role}' tidak memiliki otorisasi '${permission}'.`
    );
  }
}
