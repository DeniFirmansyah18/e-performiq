import { describe, it, expect } from 'vitest';
import { susunPromptCapaianTarget, bersihkanTeksAi } from '@/lib/services/targetAchievementAi';

const dasar = {
  scopeLevel: 'ORGANIZATION',
  overallPercentage: 80.6,
  targetCount: 52,
  achievedCount: 31,
  departments: [
    { departmentId: 'd1', departmentName: 'Keuangan', averagePercentage: 62.4, employeeCount: 9, kpiCount: 12 },
    { departmentId: 'd2', departmentName: 'Teknologi Informasi', averagePercentage: 96.1, employeeCount: 21, kpiCount: 30 },
  ],
};

describe('prompt capaian target — langkah bertahap', () => {
  it('meminta langkah bertahap, bukan sekadar poin', () => {
    const p = susunPromptCapaianTarget(dasar).toLowerCase();
    expect(p).toMatch(/langkah/);
    expect(p).toMatch(/pertama|kedua|berurutan|bertahap|urut/);
  });

  it('melarang penanda markdown seperti tanda bintang', () => {
    const p = susunPromptCapaianTarget(dasar);
    expect(p.toLowerCase()).toMatch(/jangan (memakai|menggunakan).*(markdown|bintang|\*\*)/);
  });
});

describe('bersihkanTeksAi', () => {
  it('menghapus penanda tebal ** dan merapikan judul poin', () => {
    const masukan = [
      '1. **Dewan Direksi** – capaian 0 %',
      '   - Tindakan HR: lakukan pertemuan khusus.',
    ].join('\n');
    const hasil = bersihkanTeksAi(masukan);
    expect(hasil).not.toContain('**');
    expect(hasil).toContain('Dewan Direksi');
    expect(hasil).toContain('Tindakan HR');
  });

  it('menghapus penanda markdown lain: ###, __, backtick', () => {
    const hasil = bersihkanTeksAi('### Judul\n__tebal__ dan `kode`');
    expect(hasil).not.toContain('###');
    expect(hasil).not.toContain('__');
    expect(hasil).not.toContain('`');
    expect(hasil).toContain('Judul');
    expect(hasil).toContain('tebal');
  });

  it('menjaga isi teks tetap utuh (tidak menghapus kata)', () => {
    const asli = '1. **Keuangan** – capaian 62,4 %\n   - Tindakan HR: tinjau sasaran.';
    const hasil = bersihkanTeksAi(asli);
    for (const kata of ['Keuangan', '62,4', 'Tindakan HR', 'tinjau sasaran']) {
      expect(hasil).toContain(kata);
    }
  });

  it('tidak merusak teks tanpa markdown', () => {
    const polos = '1. Dewan Direksi – capaian 0 %\nLangkah: tetapkan sasaran.';
    expect(bersihkanTeksAi(polos)).toBe(polos);
  });

  it('merapikan spasi berlebih namun tetap mempertahankan baris baru', () => {
    const hasil = bersihkanTeksAi('baris satu   \n\n   baris dua');
    expect(hasil.split('\n').length).toBeGreaterThanOrEqual(3);
    expect(hasil).toContain('baris satu');
    expect(hasil).toContain('baris dua');
  });
});
