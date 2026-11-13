// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Portal karyawan harus dapat dipakai SEMUA peran untuk memantau dirinya
 * sendiri — termasuk HR (dinilai BOD) dan People Manager (dinilai HR).
 *
 * Hanya BOD yang penilaian dirinya disembunyikan karena BOD adalah pengawas
 * tertinggi dan tidak dinilai lewat portal.
 */
const SUMBER = fs.readFileSync(
  path.join(process.cwd(), 'src/app/dashboard/employee-portal/page.tsx'),
  'utf8'
);
const MIDDLEWARE = fs.readFileSync(path.join(process.cwd(), 'src/middleware.ts'), 'utf8');
const NAV = fs.readFileSync(
  path.join(process.cwd(), 'src/components/navigation/NavMenu.tsx'),
  'utf8'
);

describe('portal karyawan untuk semua peran', () => {
  it('middleware mengizinkan BOD, HR, People Manager, dan Pegawai', () => {
    const baris = MIDDLEWARE.split(/\r?\n/).find((l) => l.includes("'employee-portal':")) ?? '';
    for (const role of ['BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE']) {
      expect(baris, role).toContain(role);
    }
  });

  it('menu "Portal Karyawan" tersedia bagi People Manager', () => {
    expect(NAV).toContain('EMPLOYEE_PORTAL_ITEM');
    expect(NAV).toMatch(/roles:\s*\[[^\]]*'PEOPLE_MANAGER'/);
  });

  it('BOD tetap tidak menampilkan penilaian diri', () => {
    expect(SUMBER).toContain("currentUser?.role === 'BOD'");
  });

  it('HR TIDAK lagi menyembunyikan penilaian dirinya', () => {
    // Regresi: sebelumnya HR ikut disembunyikan sehingga tidak bisa melihat
    // nilai kinerja & KPI miliknya sendiri.
    expect(SUMBER).not.toContain('isPenilai');
    expect(SUMBER).not.toContain("currentUser?.role === 'HR_MANAGER';\n  const sembunyikanPenilaian");
  });

  it('flag sembunyikanPenilaian hanya bergantung pada BOD', () => {
    const baris = SUMBER.split(/\r?\n/).find((l) => l.includes('const sembunyikanPenilaian')) ?? '';
    expect(baris).toBe('  const sembunyikanPenilaian = isPengawas;');
  });
});
