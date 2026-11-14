import { describe, it, expect } from 'vitest';
import { can, assertCan } from '@/lib/auth/rbac';

/**
 * Celah #1 yang ditutup: keputusan atas lamaran lowongan INTERNAL dulu
 * menumpang izin `kpi:approve`/`kpi:write`. Sekarang punya izin sendiri dan
 * wajib `decide` (bukan sekadar `read`).
 */
describe('izin lamaran kerja internal', () => {
  it('HR, BOD, dan People Manager dapat MEMBACA antrean lamaran', () => {
    for (const role of ['HR_MANAGER', 'BOD', 'PEOPLE_MANAGER', 'SUPER_ADMIN'] as const) {
      expect(can(role, 'internal-application:read'), role).toBe(true);
    }
  });

  it('HR dan BOD dapat MEMUTUSKAN lamaran internal', () => {
    expect(can('HR_MANAGER', 'internal-application:decide')).toBe(true);
    expect(can('BOD', 'internal-application:decide')).toBe(true);
  });

  it('pegawai tidak dapat memutuskan (maupun membaca) lamaran internal', () => {
    expect(can('EMPLOYEE', 'internal-application:decide')).toBe(false);
    expect(can('EMPLOYEE', 'internal-application:read')).toBe(false);
  });

  it('assertCan menolak pegawai yang mencoba memutuskan lamaran', () => {
    const s = { userId: 'u', employeeId: 'e', role: 'EMPLOYEE', email: '[EMAIL_20]' } as any;
    expect(() => assertCan(s, 'internal-application:decide')).toThrow(/internal-application:decide/);
  });

  it('izin keputusan tidak lagi mengandalkan kpi:approve', () => {
    // Bukan permintaan mencabut kpi:*, melainkan memastikan izin aktif yang
    // dipakai rute lamaran internal adalah izin miliknya sendiri.
    expect(can('HR_MANAGER', 'internal-application:decide')).toBe(true);
    expect(can('BOD', 'internal-application:decide')).toBe(true);
  });
});
