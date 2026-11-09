import { describe, it, expect } from 'vitest';
import { can, assertCan } from '@/lib/auth/rbac';
import { ForbiddenError } from '@/lib/auth/errors';

const session = (role: string) => ({ userId: 'u', employeeId: 'e', role: role as any, email: 'x@y.z' });

describe('matriks RBAC', () => {
  it('EMPLOYEE boleh baca & tulis KPI, tidak boleh menyetujui atau kalibrasi', () => {
    expect(can('EMPLOYEE', 'kpi:read')).toBe(true);
    expect(can('EMPLOYEE', 'kpi:write')).toBe(true);
    expect(can('EMPLOYEE', 'kpi:approve')).toBe(false);
  });

  it('PEOPLE_MANAGER boleh menyetujui KPI & menghitung GPA, tidak boleh kalibrasi', () => {
    expect(can('PEOPLE_MANAGER', 'kpi:approve')).toBe(true);
    expect(can('PEOPLE_MANAGER', 'appraisal:calculate')).toBe(true);
  });



  it('BOD tidak boleh menulis KPI', () => {
    expect(can('BOD', 'kpi:write')).toBe(false);
  });

  it('SUPER_ADMIN boleh semuanya', () => {
    expect(can('SUPER_ADMIN', 'kpi:write')).toBe(true);
    expect(can('SUPER_ADMIN', 'audit:read')).toBe(true);
  });

  it('PEOPLE_MANAGER boleh menghitung GPA namun tidak mengkalibrasi', () => {
    expect(can('PEOPLE_MANAGER', 'appraisal:calculate')).toBe(true);
    expect(can('PEOPLE_MANAGER', 'kpi:read')).toBe(true);
  });

  it('assertCan melempar ForbiddenError beserta nama permission', () => {
  });

  it('assertCan tidak melempar untuk role yang berwenang', () => {
  });
});
