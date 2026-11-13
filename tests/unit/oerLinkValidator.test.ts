import { describe, it, expect } from 'vitest';
import { periksaStatisOer, periksaTautanHidup, saringSumberValid } from '@/lib/services/oerLinkValidator';
import { OER_CATALOG } from '@/lib/services/oerCatalogService';

describe('validasi tautan OER — bukan mati, bukan berbayar', () => {
  it('menerima tautan penyedia OER gratis', () => {
    const r = periksaStatisOer('https://www.open.edu/openlearn/money-business/x', 'OpenLearn');
    expect(r.gratis).toBe(true);
    expect(r.hidup).toBe(true);
    expect(r.alasan).toBeNull();
  });

  it('menolak penyedia berbayar', () => {
    for (const url of [
      'https://www.udemy.com/course/x',
      'https://www.skillshare.com/classes/x',
      'https://www.pluralsight.com/courses/x',
    ]) {
      const r = periksaStatisOer(url);
      expect(r.gratis, url).toBe(false);
      expect(r.alasan).toMatch(/berbayar/i);
    }
  });

  it('menolak halaman pembelian/langganan', () => {
    expect(periksaStatisOer('https://learn.microsoft.com/checkout/x').gratis).toBe(false);
    expect(periksaStatisOer('https://alison.com/pricing').gratis).toBe(false);
    expect(periksaStatisOer('https://skillsbuild.org/subscribe').gratis).toBe(false);
  });

  it('menolak domain di luar whitelist', () => {
    const r = periksaStatisOer('https://situs-asing.example.com/kursus');
    expect(r.gratis).toBe(false);
    expect(r.alasan).toMatch(/tepercaya/i);
  });

  it('menolak tautan kosong', () => {
    expect(periksaStatisOer('').hidup).toBe(false);
  });

  it('seluruh URL katalog lolos pemeriksaan statis (hidup & gratis)', () => {
    const gagal = OER_CATALOG.map((r) => ({ r, cek: periksaStatisOer(r.url, r.provider) }))
      .filter(({ cek }) => !cek.hidup || !cek.gratis)
      .map(({ r, cek }) => `${r.title} (${cek.alasan ?? ''})`);
    expect(gagal, `entri bermasalah: ${gagal.join(' | ')}`).toEqual([]);
  });

  it('saringSumberValid membuang entri berbayar tanpa jaringan', async () => {
    const daftar = [
      { title: 'Materi Sah', url: 'https://www.open.edu/openlearn/x', provider: 'OpenLearn', topics: [] },
      { title: 'Materi Berbayar', url: 'https://www.udemy.com/course/x', provider: 'Udemy', topics: [] },
    ];
    const hasil = await saringSumberValid(daftar, { periksaJaringan: false });
    expect(hasil.map((h) => h.title)).toEqual(['Materi Sah']);
  });

  it('periksaTautanHidup menganggap galat jaringan sebagai "tidak diketahui" (bukan mati)', async () => {
    // Domain tak terdaftar DNS → fetch gagal → dianggap hidup agar materi sah
    // tidak dihapus hanya karena pemeriksa tanpa internet.
    const r = await periksaTautanHidup('https://domain-yang-pasti-tidak-ada-xyz123.invalid/x');
    expect(r.hidup).toBe(true);
    expect(r.alasan).toBeNull();
  }, 15000);
});
