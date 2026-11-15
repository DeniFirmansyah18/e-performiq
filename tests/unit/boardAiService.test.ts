import { describe, it, expect } from 'vitest';
import { hitungPersentaseVisiMisi } from '@/lib/services/boardAiService';

/**
 * #4 — Persentase pencapaian visi & misi dari BOBOT KPI yang tercapai.
 *
 * Angka DETERMINISTIK dari data (bukan karangan model). Model hanya boleh
 * menafsirkan angka ini menjadi narasi.
 */
describe('hitungPersentaseVisiMisi', () => {
  it('kosong: persentase 0 dengan catatan', () => {
    const r = hitungPersentaseVisiMisi([]);
    expect(r.persentase).toBe(0);
    expect(r.jumlahKpiTersambung).toBe(0);
    expect(r.jumlahIndikator).toBe(0);
    expect(r.catatan).toBeTruthy();
  });

  it('semua tercapai 100% -> persentase 100', () => {
    const r = hitungPersentaseVisiMisi([
      { bobot: 0.5, target: 100, realisasi: 100 },
      { bobot: 0.5, target: 100, realisasi: 100 },
    ]);
    expect(r.persentase).toBe(100);
    expect(r.jumlahBerbobot).toBe(2);
  });

  it('separuh tercapai -> 50', () => {
    const r = hitungPersentaseVisiMisi([
      { bobot: 1, target: 100, realisasi: 100 },
      { bobot: 1, target: 100, realisasi: 0 },
    ]);
    expect(r.persentase).toBe(50);
  });

  it('realisasi melebihi target tetap dibatasi 100% per KPI', () => {
    const r = hitungPersentaseVisiMisi([
      { bobot: 1, target: 100, realisasi: 250 },
    ]);
    expect(r.persentase).toBe(100);
  });

  it('sasaran tanpa target/realisasi dihitung 0 (tidak melonjak persentase)', () => {
    const r = hitungPersentaseVisiMisi([
      { bobot: 1, target: 100, realisasi: 100 },
      { bobot: 1, target: null, realisasi: null },
    ]);
    // 1 tercapai (bobot 1) + 1 belum berukuran (bobot 1, dihitung 0) -> 50
    expect(r.persentase).toBe(50);
    expect(r.catatan).toMatch(/belum memiliki target|belum memiliki ukuran/i);
  });

  it('bobot total nol atau negatif -> aman', () => {
    const r = hitungPersentaseVisiMisi([{ bobot: 0, target: 100, realisasi: 100 }]);
    expect(r.persentase).toBe(0);
  });
});
