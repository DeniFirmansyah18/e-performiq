import { describe, it, expect } from 'vitest';
import {
  normalkanBobotTurunan,
  sanitasiTurunan,
  usulkanTurunanFallback,
  type KonteksTurunan,
} from '@/lib/services/kpiCascadeAiService';

/**
 * Generator KPI turunan (BOD -> HR -> People Manager -> Pegawai).
 * Bagian deterministik diuji di sini; panggilan AI diuji lewat integrasi.
 */
describe('normalkanBobotTurunan', () => {
  it('memperbaiki total 99 / 101 menjadi tepat 100', () => {
    expect(normalkanBobotTurunan([30, 30, 30, 9]).reduce((a, b) => a + b, 0)).toBe(100);
    expect(normalkanBobotTurunan([30, 30, 30, 11]).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('membagi rata bila semua bobot nol, tetap total 100', () => {
    const r = normalkanBobotTurunan([0, 0, 0]);
    expect(r.reduce((a, b) => a + b, 0)).toBe(100);
    expect(r.every((x) => x > 0)).toBe(true);
  });

  it('tidak menghasilkan bobot negatif', () => {
    expect(normalkanBobotTurunan([-5, 50, 50]).every((x) => x >= 0)).toBe(true);
  });
});

describe('sanitasiTurunan', () => {
  it('membuang entri tanpa judul valid / target / satuan sah', () => {
    const hasil = sanitasiTurunan([
      { kpiTitle: 'Ok', targetValue: 100, unitOfMeasure: '%', weightPct: 50 },
      { kpiTitle: 'Judul terlalu pendek', targetValue: 0, unitOfMeasure: '%' },
      { kpiTitle: 'Satuan aneh sekali', targetValue: 10, unitOfMeasure: 'BULAN' },
      { kpiTitle: 'Skor kepatuhan proses mutu', targetValue: 95, unitOfMeasure: '%', weightPct: 50 },
    ]);
    expect(hasil.length).toBe(1);
    expect(hasil[0].kpiTitle).toBe('Skor kepatuhan proses mutu');
    expect(hasil[0].weightPct).toBe(100);
  });

  it('membatasi maksimal 5 usulan', () => {
    const banyak = Array.from({ length: 9 }, (_, i) => ({
      kpiTitle: `Indikator mutu nomor ${i + 1}`,
      targetValue: 90,
      unitOfMeasure: '%',
      weightPct: 10,
    }));
    expect(sanitasiTurunan(banyak).length).toBe(5);
  });
});

describe('usulkanTurunanFallback', () => {
  const ctx: KonteksTurunan = {
    tingkat: 'DEPARTEMEN',
    indukJudul: 'Skor kepuasan pasien total',
    indukTarget: 90,
    indukSatuan: '%',
    pemilik: 'Instalasi Rawat Inap',
  };

  it('menghasilkan usulan yang menyebut pemilik & KPI induk', () => {
    const u = usulkanTurunanFallback(ctx);
    expect(u.length).toBeGreaterThanOrEqual(2);
    expect(u[0].kpiTitle).toContain('Instalasi Rawat Inap');
    expect(u[0].kpiTitle).toContain('Skor kepuasan pasien total');
  });

  it('bobot total tepat 100 dan target positif', () => {
    const u = usulkanTurunanFallback(ctx);
    expect(u.reduce((a, b) => a + b.weightPct, 0)).toBe(100);
    expect(u.every((x) => x.targetValue > 0)).toBe(true);
  });

  it('aman bila satuan induk tidak dikenal', () => {
    const u = usulkanTurunanFallback({ ...ctx, indukSatuan: 'BULAN' });
    expect(u.every((x) => ['%', 'IDR', 'UNIT', 'HARI', 'SKOR'].includes(x.unitOfMeasure))).toBe(true);
  });
});
