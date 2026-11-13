// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Panel fitur harus dirender TEPAT DI BAWAH kartu pada grupnya, mengikuti pola
 * "Kontrol Siklus 3-Fase" di HR — bukan di akhir halaman.
 */
const PORTAL = fs.readFileSync(
  path.join(process.cwd(), 'src/app/dashboard/employee-portal/page.tsx'),
  'utf8'
);
const HR = fs.readFileSync(path.join(process.cwd(), 'src/app/dashboard/hr-command/page.tsx'), 'utf8');

describe('panel kartu tampil tepat di bawah kartu', () => {
  it('portal merender panel DI DALAM blok grup (setelah grid kartu)', () => {
    const iGrup = PORTAL.indexOf('{grupLayanan.map(');
    const iPanel = PORTAL.indexOf("grup.judul === 'Profil & Bantuan'");
    const iTutupGrup = PORTAL.indexOf('</section>', iGrup);
    expect(iGrup).toBeGreaterThan(-1);
    expect(iPanel).toBeGreaterThan(iGrup);
    // Panel berada sebelum penutup <section> grup → masih di dalam grup.
    expect(iPanel).toBeLessThan(iTutupGrup);
  });

  it('tiap grup menampilkan panelnya sendiri', () => {
    expect(PORTAL).toContain("grup.judul === 'Profil & Bantuan'");
    expect(PORTAL).toContain("grup.judul === 'Kinerja & Penilaian'");
    expect(PORTAL).toContain("grup.judul === 'Kehadiran & Waktu'");
  });

  it('HR tetap memakai pola yang sama (acuan)', () => {
    expect(HR).toContain('Panel fitur golongan ini, tampil tepat di bawah kartunya');
  });

  it('tidak ada lagi panel yatim di luar grup pada portal', () => {
    // Panel lama yang berdiri sendiri setelah blok grup sudah dihapus.
    const setelahGrup = PORTAL.slice(PORTAL.indexOf('</section>\n  ))}'));
    expect(setelahGrup).not.toMatch(/openFeature === '(profile|timesheet|okr|scorecard)'/);
  });

  it('panel memakai Prop open/onClose agar dapat dirender di grup mana pun', () => {
    expect(PORTAL).toContain('function NilaiKinerjaPanel({ open, onClose');
  });
});
