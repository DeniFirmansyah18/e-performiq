import { describe, it, expect } from 'vitest';
import {
  bolehTurunkan,
  telaahRantai,
  jumlahWajar,
  SARAN_JUMLAH_KPI,
  PENETAP_TINGKAT,
  type MataRantai,
} from '@/lib/services/kpiCascade';

describe('alur jabatan BOD → HR → People Manager → Pegawai', () => {
  it('BOD menurunkan KPI perusahaan ke departemen (HR)', () => {
    expect(bolehTurunkan('BOD', 'PERUSAHAAN', 'DEPARTEMEN')).toBe(true);
    // BOD tidak langsung menurunkan ke posisi/pegawai (harus lewat HR).
    expect(bolehTurunkan('BOD', 'PERUSAHAAN', 'POSISI')).toBe(false);
    expect(bolehTurunkan('BOD', 'PERUSAHAAN', 'INDIVIDU')).toBe(false);
  });

  it('HR menurunkan departemen ke People Manager dan ke bawahnya', () => {
    expect(bolehTurunkan('HR_MANAGER', 'DEPARTEMEN', 'MANAJER')).toBe(true);
    expect(bolehTurunkan('HR_MANAGER', 'MANAJER', 'POSISI')).toBe(true);
    expect(bolehTurunkan('HR_MANAGER', 'POSISI', 'INDIVIDU')).toBe(true);
  });

  it('People Manager menurunkan ke posisi & pegawai, tidak ke perusahaan', () => {
    expect(bolehTurunkan('PEOPLE_MANAGER', 'POSISI', 'INDIVIDU')).toBe(true);
    expect(bolehTurunkan('PEOPLE_MANAGER', 'PERUSAHAAN', 'DEPARTEMEN')).toBe(false);
  });

  it('pegawai tidak boleh menurunkan KPI ke siapa pun', () => {
    expect(bolehTurunkan('EMPLOYEE', 'POSISI', 'INDIVIDU')).toBe(false);
    expect(bolehTurunkan('EMPLOYEE', 'PERUSAHAAN', 'DEPARTEMEN')).toBe(false);
  });

  it('tidak boleh melompati satu tingkat', () => {
    expect(bolehTurunkan('HR_MANAGER', 'DEPARTEMEN', 'INDIVIDU')).toBe(false);
    expect(bolehTurunkan('BOD', 'PERUSAHAAN', 'MANAJER')).toBe(false);
  });

  it('penetap tiap tingkat sesuai alur', () => {
    expect(PENETAP_TINGKAT.PERUSAHAAN).toContain('BOD');
    expect(PENETAP_TINGKAT.PERUSAHAAN).not.toContain('HR_MANAGER');
    expect(PENETAP_TINGKAT.DEPARTEMEN).toContain('HR_MANAGER');
    expect(PENETAP_TINGKAT.INDIVIDU).toContain('EMPLOYEE');
  });
});

describe('telaah rantai KPI sampai visi & misi', () => {
  const RANTAI: MataRantai[] = [
    { kode: 'CORP-1', judul: 'Laba Bersih', tingkat: 'PERUSAHAAN', induk: null },
    { kode: 'DIV-TECH', judul: 'Kualitas Layanan TI', tingkat: 'DEPARTEMEN', induk: 'CORP-1' },
    { kode: 'MGR-ENG', judul: 'SLA Engineering', tingkat: 'MANAJER', induk: 'DIV-TECH' },
    { kode: 'POS-SWE', judul: 'Uptime Layanan SWE', tingkat: 'POSISI', induk: 'MGR-ENG' },
    { kode: 'IND-BUDI', judul: 'Tiket Selesai', tingkat: 'INDIVIDU', induk: 'POS-SWE' },
  ];

  it('rantai lengkap dinyatakan tersambung dengan kedalaman 5', () => {
    const r = telaahRantai(RANTAI);
    expect(r.putus).toEqual([]);
    expect(r.tersambung.length).toBe(5);
    expect(r.kedalamanMaksimal).toBe(5);
    expect(r.kesimpulan).toContain('tersambung');
  });

  it('KPI tanpa induk di tingkat bawah dianggap PUTUS', () => {
    const r = telaahRantai([
      ...RANTAI,
      { kode: 'IND-NYASAR', judul: 'KPI Lepas', tingkat: 'INDIVIDU', induk: null },
    ]);
    expect(r.putus.length).toBe(1);
    expect(r.putus[0].kode).toBe('IND-NYASAR');
    expect(r.putus[0].alasan).toMatch(/pilar strategis/i);
    expect(r.kesimpulan).toContain('belum tersambung');
  });

  it('induk yang tidak ditemukan membuat rantai putus', () => {
    const r = telaahRantai([
      { kode: 'IND-X', judul: 'KPI Yatim', tingkat: 'INDIVIDU', induk: 'TIDAK-ADA' },
    ]);
    expect(r.putus[0].alasan).toContain('TIDAK-ADA');
  });

  it('rantai melingkar tidak membuat perhitungan tanpa henti', () => {
    const r = telaahRantai([
      { kode: 'A', judul: 'A', tingkat: 'INDIVIDU', induk: 'B' },
      { kode: 'B', judul: 'B', tingkat: 'POSISI', induk: 'A' },
    ]);
    expect(r.putus.length).toBeGreaterThan(0);
  });

  it('rantai kosong tidak menimbulkan galat', () => {
    const r = telaahRantai([]);
    expect(r.tersambung).toEqual([]);
    expect(r.putus).toEqual([]);
  });
});

describe('jumlah KPI wajar per tingkat', () => {
  it('pegawai 3–5 KPI', () => {
    expect(jumlahWajar('INDIVIDU', 2)).toBe(false);
    expect(jumlahWajar('INDIVIDU', 3)).toBe(true);
    expect(jumlahWajar('INDIVIDU', 5)).toBe(true);
    expect(jumlahWajar('INDIVIDU', 6)).toBe(false);
  });

  it('perusahaan 3–5 KPI', () => {
    expect(SARAN_JUMLAH_KPI.PERUSAHAAN.min).toBe(3);
    expect(jumlahWajar('PERUSAHAAN', 4)).toBe(true);
  });

  it('people manager 2–4 KPI', () => {
    expect(jumlahWajar('MANAJER', 1)).toBe(false);
    expect(jumlahWajar('MANAJER', 3)).toBe(true);
  });
});
