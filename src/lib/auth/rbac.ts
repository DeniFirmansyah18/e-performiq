import type { UserRole } from '@/types';
import { ForbiddenError } from './errors';
import type { SessionPayload } from './session';

export type Permission =
| 'kpi:read'
| 'kpi:write'
| 'kpi:approve'
| 'appraisal:calculate'
| 'appraisal:calibrate'
| 'appraisal:batch'
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
| 'offboarding:read'
| 'offboarding:write'
| 'ai:read'
| 'wbs:read'
| 'employment:read'
| 'employment:manage'
| 'attendance:correct'
| 'overtime:read'
| 'overtime:request'
| 'overtime:approve'
| 'document:read'
| 'document:write'
| 'document:verify'
| 'social_security:read'
| 'social_security:reveal'
| 'career:read'
| 'letter:read'
| 'letter:manage'
| 'letter:dispose'
| 'chat:read'
| 'chat:write'
| 'policy:manage'
| 'career:manage'
| 'social_security:manage'
| 'disciplinary:manage';

/** Satu matriks deklaratif, bukan if tersebar di 18 route (spec §6.2).

Permission sensitif (gaji, risiko, WBS) dikunci ke role yang berhak (GCG). */
const MATRIX: Record<Permission, ReadonlyArray<UserRole>> = {
'kpi:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE', 'AUDITOR', 'ASSESSOR'],
'kpi:write': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'kpi:approve': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER'],
'appraisal:calculate': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER', 'ASSESSOR'],
'appraisal:calibrate': ['SUPER_ADMIN', 'HR_MANAGER', 'BOD', 'ASSESSOR'],
'appraisal:batch': ['SUPER_ADMIN', 'HR_MANAGER'],
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
'profile:write': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE', 'AUDITOR'],
'offboarding:read': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER', 'BOD', 'EMPLOYEE', 'AUDITOR'],
'offboarding:write': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'ai:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE', 'AUDITOR', 'ASSESSOR'],
'wbs:read': ['SUPER_ADMIN', 'AUDITOR'],
'employment:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'AUDITOR', 'EMPLOYEE'],
'employment:manage': ['SUPER_ADMIN', 'HR_MANAGER'],
'attendance:correct': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER'],
'overtime:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'AUDITOR', 'EMPLOYEE'],
'overtime:request': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'overtime:approve': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER'],
'document:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'AUDITOR', 'EMPLOYEE'],
'document:write': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'document:verify': ['SUPER_ADMIN', 'HR_MANAGER'],
'social_security:read': ['SUPER_ADMIN', 'HR_MANAGER', 'EMPLOYEE'],
'social_security:reveal': ['SUPER_ADMIN', 'HR_MANAGER', 'EMPLOYEE'],
'career:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'AUDITOR', 'EMPLOYEE'],
'career:manage': ['SUPER_ADMIN', 'HR_MANAGER'],
'social_security:manage': ['SUPER_ADMIN', 'HR_MANAGER'],
'disciplinary:manage': ['SUPER_ADMIN', 'HR_MANAGER'],
'letter:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'AUDITOR', 'EMPLOYEE'],
'letter:manage': ['SUPER_ADMIN', 'HR_MANAGER'],
'letter:dispose': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER'],
'chat:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'AUDITOR', 'EMPLOYEE'],
'chat:write': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'policy:manage': ['SUPER_ADMIN', 'HR_MANAGER'],
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
