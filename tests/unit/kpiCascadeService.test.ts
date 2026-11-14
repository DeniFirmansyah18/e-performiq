import { describe, expect, it } from 'vitest';
import { bolehTurunkan, telaahRantai } from '@/lib/services/kpiCascade';
import { validasiBobotKpi } from '@/lib/services/kpiCascadeService';

describe('validasi bobot KPI berjenjang', () => {
  it('menerima bobot lebih dari nol hingga 100 tanpa mewajibkan total tingkat 100', () => {
    expect(validasiBobotKpi(0.01)).toBe(true);
    expect(validasiBobotKpi(60)).toBe(true);
    expect(validasiBobotKpi(100)).toBe(true);
    expect([35, 20].every(validasiBobotKpi)).toBe(true);
  });

  it('menolak bobot kosong, nol, negatif, di atas 100, dan bukan angka', () => {
    expect(validasiBobotKpi(0)).toBe(false);
    expect(validasiBobotKpi(-1)).toBe(false);
    expect(validasiBobotKpi(100.01)).toBe(false);
    expect(validasiBobotKpi(Number.NaN)).toBe(false);
  });
});

describe('otorisasi dan telaah rantai cascade', () => {
  it('mengizinkan hanya penurunan satu tingkat menurut peran', () => {
    expect(bolehTurunkan('BOD', 'PERUSAHAAN', 'DEPARTEMEN')).toBe(true);
    expect(bolehTurunkan('HR_MANAGER', 'DEPARTEMEN', 'MANAJER')).toBe(true);
    expect(bolehTurunkan('PEOPLE_MANAGER', 'MANAJER', 'POSISI')).toBe(true);
    expect(bolehTurunkan('EMPLOYEE', 'POSISI', 'INDIVIDU')).toBe(false);
    expect(bolehTurunkan('BOD', 'PERUSAHAAN', 'POSISI')).toBe(false);
  });

  it('menganggap tingkat antara yang belum diturunkan bukan rantai putus', () => {
    const hasil = telaahRantai([
      { kode: 'CORP-1', judul: 'Pertumbuhan', tingkat: 'PERUSAHAAN', induk: null },
      { kode: 'DIV-1', judul: 'Pendapatan divisi', tingkat: 'DEPARTEMEN', induk: 'CORP-1' },
    ]);
    expect(hasil.putus).toEqual([]);
    expect(hasil.tersambung).toHaveLength(2);
  });
});
