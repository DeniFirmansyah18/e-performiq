import { describe, it, expect } from 'vitest';
import { ROLE_LIST } from '@/types';
import { can } from '@/lib/auth/rbac';

/**
 * Setiap pegawai berhak melihat kartu BPJS-nya sendiri lewat `/api/v1/me/*`.
 * Endpoint itu memakai `social_security:read`, jadi seluruh peran harus
 * memilikinya — termasuk People Manager dan BOD yang sebelumnya tidak.
 */
describe('akses kartu BPJS pribadi', () => {
  it('semua peran boleh membaca BPJS-nya sendiri', () => {
    for (const role of ROLE_LIST) {
      expect(can(role, 'social_security:read'), `${role} harus bisa membaca`).toBe(true);
    }
  });

  it('semua peran boleh membuka nomor penuh miliknya sendiri (dengan audit log)', () => {
    for (const role of ROLE_LIST) {
      expect(can(role, 'social_security:reveal'), `${role} harus bisa reveal`).toBe(true);
    }
  });

  it('mengelola BPJS karyawan lain tetap hanya untuk HR dan Super Admin', () => {
    expect(can('HR_MANAGER', 'social_security:manage')).toBe(true);
    expect(can('SUPER_ADMIN', 'social_security:manage')).toBe(true);
    expect(can('BOD', 'social_security:manage')).toBe(false);
    expect(can('PEOPLE_MANAGER', 'social_security:manage')).toBe(false);
    expect(can('EMPLOYEE', 'social_security:manage')).toBe(false);
  });
});
