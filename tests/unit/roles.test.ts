import { describe, it, expect } from 'vitest';
import { ROLE_LIST } from '@/types';
import { can } from '@/lib/auth/rbac';

describe('peran setelah penyederhanaan', () => {
  it('hanya ada lima peran, tanpa AUDITOR', () => {
    expect(ROLE_LIST).toEqual(['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE']);
    expect(ROLE_LIST).not.toContain('AUDITOR');
  });

  it('tidak ada permission yang masih memberi akses ke AUDITOR', () => {
    // Dipanggil lewat string agar tes tidak bergantung pada tipe UserRole.
    const perms = ['audit:read', 'payroll:read', 'analytics:read', 'kpi:read', 'profile:read'] as const;
    for (const perm of perms) {
      expect(can('AUDITOR' as any, perm as any)).toBe(false);
    }
  });
});
