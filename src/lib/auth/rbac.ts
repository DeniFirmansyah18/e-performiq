import type { UserRole } from '@/types';
import { ForbiddenError } from './errors';
import type { SessionPayload } from './session';

export type Permission =
| 'kpi:read'
| 'kpi:write'
| 'kpi:approve'
| 'appraisal:calculate'
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
| 'directory:read'
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
| 'disciplinary:manage'
| 'analytics:manage'
| 'system:health'
| 'user:read'
| 'user:manage'
| 'postemployment:read'
| 'postemployment:manage'
| 'postemployment:alumni'
| 'postemployment:analytics';

/** Satu matriks deklaratif, bukan if tersebar di 18 route (spec §6.2).

Permission sensitif (gaji, risiko, WBS) dikunci ke role yang berhak (GCG). */
const MATRIX: Record<Permission, ReadonlyArray<UserRole>> = {
'kpi:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'kpi:write': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'kpi:approve': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER'],
'appraisal:calculate': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER'],
'appraisal:batch': ['SUPER_ADMIN', 'HR_MANAGER'],
'audit:read': ['SUPER_ADMIN'],
'attendance:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'attendance:write': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'attendance:approve': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER'],
'payroll:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER'],
'payroll:manage': ['SUPER_ADMIN', 'HR_MANAGER'],
'flight_risk:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER'],
'analytics:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER'],
'learning:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'learning:write': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'learning:manage': ['SUPER_ADMIN', 'HR_MANAGER'],
'recruitment:read': ['SUPER_ADMIN', 'HR_MANAGER', 'BOD'],
'recruitment:manage': ['SUPER_ADMIN', 'HR_MANAGER'],
'profile:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'profile:write': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'offboarding:read': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER', 'BOD', 'EMPLOYEE'],
'offboarding:write': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'ai:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'wbs:read': ['SUPER_ADMIN'],
// `employment:read` mencakup pembacaan status kepegawaian DIRI SENDIRI
// (`/api/v1/me/employment-status`), jadi semua peran memilikinya.
'employment:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
// Direktori seluruh pegawai adalah objek berbeda: mencakup semua departemen,
// sehingga tidak boleh memakai `employment:read`. Karyawan tidak memerlukannya.
'directory:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER'],
'employment:manage': ['SUPER_ADMIN', 'HR_MANAGER'],
'attendance:correct': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER'],
'overtime:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'overtime:request': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'overtime:approve': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER'],
'document:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'document:write': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'document:verify': ['SUPER_ADMIN', 'HR_MANAGER'],
'social_security:read': ['SUPER_ADMIN', 'HR_MANAGER', 'EMPLOYEE'],
'social_security:reveal': ['SUPER_ADMIN', 'HR_MANAGER', 'EMPLOYEE'],
'career:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'career:manage': ['SUPER_ADMIN', 'HR_MANAGER'],
'social_security:manage': ['SUPER_ADMIN', 'HR_MANAGER'],
'disciplinary:manage': ['SUPER_ADMIN', 'HR_MANAGER'],
'analytics:manage': ['SUPER_ADMIN', 'HR_MANAGER', 'BOD'],
'system:health': ['SUPER_ADMIN', 'HR_MANAGER'],
'letter:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'letter:manage': ['SUPER_ADMIN', 'HR_MANAGER'],
'letter:dispose': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER'],
'chat:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'chat:write': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'policy:manage': ['SUPER_ADMIN', 'HR_MANAGER'],
// Manajemen akun hanya milik SUPER_ADMIN: mengubah peran/aktivasi berarti
// mengubah otorisasi, sehingga HR pun tidak boleh.
'user:read': ['SUPER_ADMIN'],
'user:manage': ['SUPER_ADMIN'],
// Pasca-kerja dipisah dari `offboarding:*` agar karyawan tetap bisa membaca data
// pribadinya (checklist aset, kewajiban, surat) tetapi tidak mengubah apa pun.
'postemployment:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
'postemployment:manage': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER'],
'postemployment:alumni': ['SUPER_ADMIN', 'HR_MANAGER'],
'postemployment:analytics': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER'],
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
