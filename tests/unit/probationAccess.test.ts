import { describe, it, expect } from 'vitest';
import { can } from '@/lib/auth/rbac';

/**
 * People Manager boleh MENGISI evaluasi probation
 * (preEmploymentService.evaluateProbationMilestone mengizinkan peran ini),
 * maka ia juga harus boleh MELIHAT daftar evaluasi probation.
 * Tanpa `recruitment:read`, Manager Cockpit selalu kosong dan tombol
 * "Evaluasi" tidak pernah aktif.
 */
describe('akses daftar evaluasi probation', () => {
  it('People Manager boleh membaca daftar probation (agar bisa mengevaluasi)', () => {
    expect(can('PEOPLE_MANAGER', 'recruitment:read')).toBe(true);
  });

  it('HR Manager, BOD, dan Super Admin tetap boleh membaca', () => {
    expect(can('HR_MANAGER', 'recruitment:read')).toBe(true);
    expect(can('BOD', 'recruitment:read')).toBe(true);
    expect(can('SUPER_ADMIN', 'recruitment:read')).toBe(true);
  });

  it('Employee tidak boleh membaca daftar probation', () => {
    expect(can('EMPLOYEE', 'recruitment:read')).toBe(false);
  });
});
