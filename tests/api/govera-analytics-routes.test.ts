import { describe, it, expect } from 'vitest';
import { can } from '@/lib/auth/rbac';
import { getAuthSession } from '@/lib/auth/getAuthSession';

describe('GCG: matriks permission menutup akses analitik sensitif', () => {
it('EMPLOYEE tidak boleh membaca flight_risk, payroll, dan WBS', () => {
expect(can('EMPLOYEE', 'flight_risk:read')).toBe(false);
expect(can('EMPLOYEE', 'payroll:read')).toBe(false);
expect(can('EMPLOYEE', 'wbs:read')).toBe(false);
});

it('HR_MANAGER boleh membaca flight_risk dan payroll', () => {
expect(can('HR_MANAGER', 'flight_risk:read')).toBe(true);
expect(can('HR_MANAGER', 'payroll:read')).toBe(true);
});

it('permintaan tanpa sesi ditolak (AuthError -> 401 via problem())', async () => {
const fakeReq = {
cookies: { get: () => undefined },
headers: new Headers(),
} as any;
await expect(getAuthSession(fakeReq)).rejects.toThrow();
});
});
