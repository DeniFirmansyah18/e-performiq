import type { UserRole } from '@/types';
import { ForbiddenError } from './errors';
import type { SessionPayload } from './session';

export type Permission =
| 'kpi:read'
| 'kpi:write'
| 'kpi:approve'
| 'appraisal:calculate'
| 'appraisal:calibrate'
| 'audit:read'
| 'attendance:read'
| 'attendance:write'
| 'attendance:approve'
| 'payroll:read'
| 'payroll:manage'
| 'flight_risk:read'
| 'analytics:read'
| 'learning:read'
| 'learning:write'
| 'learning:manage'
| 'recruitment:read'
| 'recruitment:manage'
| 'profile:read'
| 'profile:write'
| 'ai:read'
| 'wbs:read';

/** Satu matriks deklaratif, bukan if tersebar di 18 route (spec §6.2).

Permission sensitif (gaji, risiko, WBS) dikunci ke role yang berhak (GCG). */
const MATRIX: Record<Permission, ReadonlyArray<UserRole>> = {
'kpi:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE', 'AUDITOR', 'ASSESSOR'],
'kpi:write': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'kpi:approve': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER'],
'appraisal:calculate': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER', 'ASSESSOR'],
'appraisal:calibrate': ['SUPER_ADMIN', 'HR_MANAGER', 'BOD', 'ASSESSOR'],
'audit:read': ['SUPER_ADMIN', 'AUDITOR'],
'attendance:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'AUDITOR', 'EMPLOYEE'],
'attendance:write': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'attendance:approve': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER'],
'payroll:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'AUDITOR'],
'payroll:manage': ['SUPER_ADMIN', 'HR_MANAGER'],
'flight_risk:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER'],
'analytics:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'AUDITOR'],
'learning:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE', 'AUDITOR', 'ASSESSOR'],
'learning:write': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'learning:manage': ['SUPER_ADMIN', 'HR_MANAGER'],
'recruitment:read': ['SUPER_ADMIN', 'HR_MANAGER', 'BOD', 'AUDITOR'],
'recruitment:manage': ['SUPER_ADMIN', 'HR_MANAGER'],
'profile:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE', 'AUDITOR', 'ASSESSOR'],
'profile:write': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE', 'AUDITOR', 'ASSESSOR'],
'ai:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE', 'AUDITOR', 'ASSESSOR'],
'wbs:read': ['SUPER_ADMIN', 'AUDITOR'],
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
