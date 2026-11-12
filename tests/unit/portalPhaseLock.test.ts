import { describe, it, expect } from 'vitest';
import { wajibSelesaikanPraKerja, faseYangBolehDibuka } from '@/lib/employee/phase';

/**
 * Aturan baru: SELURUH pegawai — termasuk yang sudah PERMANENT karena
 * dikonversi dari kandidat — wajib menyelesaikan fase Sebelum Kerja lebih
 * dulu. Selama belum selesai, Saat Kerja & Setelah Kerja terkunci.
 */
describe('kunci fase: wajib selesaikan Sebelum Kerja lebih dulu', () => {
  it('pegawai PERMANENT yang belum menyelesaikan orientasi tetap terkunci', () => {
    const f = faseYangBolehDibuka({
      status: 'PERMANENT',
      phase: 'PRE',
      milestonesDone: 1,
      milestonesTotal: 3,
    });
    expect(f.boleh, 'hanya Sebelum Kerja').toEqual(['PRE']);
    expect(f.terkunci.DURING).toBe(true);
    expect(f.terkunci.POST).toBe(true);
    expect(f.alasanKunci).toContain('1 dari 3');
  });

  it('pegawai PROBATION yang belum selesai juga terkunci', () => {
    const f = faseYangBolehDibuka({ status: 'PROBATION', phase: 'PRE', milestonesDone: 0, milestonesTotal: 3 });
    expect(f.terkunci.DURING).toBe(true);
    expect(f.terkunci.POST).toBe(true);
  });

  it('setelah fase Sebelum Kerja SELESAI, semua fase terbuka', () => {
    const f = faseYangBolehDibuka({
      status: 'PERMANENT',
      phase: 'PRE',
      milestonesDone: 3,
      milestonesTotal: 3,
    });
    expect(f.boleh).toEqual(['PRE', 'DURING', 'POST']);
    expect(f.terkunci.DURING).toBe(false);
    expect(f.terkunci.POST).toBe(false);
    expect(f.alasanKunci).toBeNull();
  });

  it('pegawai yang sudah berada di fase Saat/Pasca Kerja tidak dikunci', () => {
    // Sudah melewati Sebelum Kerja (ditandai berpindah fase).
    const d = faseYangBolehDibuka({ status: 'PERMANENT', phase: 'DURING', milestonesDone: 0, milestonesTotal: 3 });
    expect(d.terkunci.DURING).toBe(false);
    const p = faseYangBolehDibuka({ status: 'PERMANENT', phase: 'POST', milestonesDone: 0, milestonesTotal: 3 });
    expect(p.terkunci.POST).toBe(false);
  });

  it('status program "COMPLETED" dianggap selesai walau milestone kosong', () => {
    const f = faseYangBolehDibuka({
      status: 'PERMANENT',
      phase: 'PRE',
      milestonesDone: 0,
      milestonesTotal: 3,
      programStatus: 'COMPLETED',
    });
    expect(f.terkunci.DURING).toBe(false);
  });

  it('probationPassed menandai orientasi selesai', () => {
    const f = faseYangBolehDibuka({
      status: 'PROBATION',
      phase: 'PRE',
      milestonesDone: 2,
      milestonesTotal: 3,
      probationPassed: true,
    });
    expect(f.terkunci.DURING).toBe(false);
  });

  it('wajibSelesaikanPraKerja tidak lagi bergantung pada status kepegawaian', () => {
    // Sebelumnya PERMANENT langsung lolos.
    expect(wajibSelesaikanPraKerja({ status: 'PERMANENT', phase: 'PRE' })).toBe(true);
    expect(wajibSelesaikanPraKerja({ status: 'PROBATION', phase: 'PRE' })).toBe(true);
    // Sudah melewati fase PRE → tidak dikunci.
    expect(wajibSelesaikanPraKerja({ status: 'PERMANENT', phase: 'DURING' })).toBe(false);
  });

  it('tanpa data profil, tidak memblokir apa pun (hindari kunci palsu)', () => {
    const f = faseYangBolehDibuka({});
    expect(f.terkunci.DURING).toBe(false);
  });
});
