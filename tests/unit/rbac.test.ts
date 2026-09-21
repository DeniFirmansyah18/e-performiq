import { describe, it, expect } from 'vitest';
import { can, assertCan } from '@/lib/auth/rbac';
import { ForbiddenError } from '@/lib/auth/errors';

const session = (role: string) => ({ userId: 'u', employeeId: 'e', role: role as any, email: 'x@y.z' });

describe('matriks RBAC', () => {
  it('EMPLOYEE boleh baca & tulis KPI, tidak boleh menyetujui atau kalibrasi', () => {
    expect(can('EMPLOYEE', 'kpi:read')).toBe(true);
    expect(can('EMPLOYEE', 'kpi:write')).toBe(true);
    expect(can('EMPLOYEE', 'kpi:approve')).toBe(false);
    expect(can('EMPLOYEE', 'appraisal:calibrate')).toBe(false);
  });

  it('PEOPLE_MANAGER boleh menyetujui KPI & menghitung GPA, tidak boleh kalibrasi', () => {
    expect(can('PEOPLE_MANAGER', 'kpi:approve')).toBe(true);
    expect(can('PEOPLE_MANAGER', 'appraisal:calculate')).toBe(true);
    expect(can('PEOPLE_MANAGER', 'appraisal:calibrate')).toBe(false);
  });

  it('HR_MANAGER dan BOD boleh kalibrasi', () => {
    expect(can('HR_MANAGER', 'appraisal:calibrate')).toBe(true);
    expect(can('BOD', 'appraisal:calibrate')).toBe(true);
  });

  it('AUDITOR hanya boleh membaca audit log', () => {
    expect(can('AUDITOR', 'audit:read')).toBe(true);
    expect(can('AUDITOR', 'kpi:write')).toBe(false);
    expect(can('AUDITOR', 'appraisal:calibrate')).toBe(false);
  });

  it('BOD tidak boleh menulis KPI', () => {
    expect(can('BOD', 'kpi:write')).toBe(false);
  });

  it('SUPER_ADMIN boleh semuanya', () => {
    expect(can('SUPER_ADMIN', 'kpi:write')).toBe(true);
    expect(can('SUPER_ADMIN', 'appraisal:calibrate')).toBe(true);
    expect(can('SUPER_ADMIN', 'audit:read')).toBe(true);
  });

  it('assertCan melempar ForbiddenError beserta nama permission', () => {
    expect(() => assertCan(session('EMPLOYEE'), 'appraisal:calibrate'))
      .toThrow(ForbiddenError);
    expect(() => assertCan(session('EMPLOYEE'), 'appraisal:calibrate'))
      .toThrow(/appraisal:calibrate/);
  });

  it('assertCan tidak melempar untuk role yang berwenang', () => {
    expect(() => assertCan(session('HR_MANAGER'), 'appraisal:calibrate')).not.toThrow();
  });
});
