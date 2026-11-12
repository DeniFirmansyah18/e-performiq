import { describe, it, expect } from 'vitest';
import { wajibSelesaikanPraKerja, faseYangBolehDibuka } from '@/lib/employee/phase';

describe('kunci fase portal pegawai', () => {
  it('pegawai PROBATION terkunci di fase Sebelum Kerja', () => {
    expect(wajibSelesaikanPraKerja({ status: 'PROBATION', phase: 'PRE' })).toBe(true);

    const f = faseYangBolehDibuka({ status: 'PROBATION', phase: 'PRE', milestonesDone: 1, milestonesTotal: 3 });
    expect(f.boleh).toEqual(['PRE']);
    expect(f.terkunci.DURING).toBe(true);
    expect(f.terkunci.POST).toBe(true);
    expect(f.alasanKunci).toContain('1 dari 3');
  });

  it('pegawai PERMANENT bebas membuka semua fase', () => {
    expect(wajibSelesaikanPraKerja({ status: 'PERMANENT', phase: 'DURING' })).toBe(false);

    const f = faseYangBolehDibuka({ status: 'PERMANENT', phase: 'DURING' });
    expect(f.boleh).toEqual(['PRE', 'DURING', 'POST']);
    expect(f.terkunci.DURING).toBe(false);
    expect(f.alasanKunci).toBeNull();
  });

  it('pegawai CONTRACT juga bebas membuka semua fase', () => {
    const f = faseYangBolehDibuka({ status: 'CONTRACT', phase: 'DURING' });
    expect(f.terkunci.DURING).toBe(false);
    expect(f.boleh).toEqual(['PRE', 'DURING', 'POST']);
  });

  it('probation yang sudah berpindah fase tidak dikunci lagi', () => {
    expect(wajibSelesaikanPraKerja({ status: 'PROBATION', phase: 'DURING' })).toBe(false);
    const f = faseYangBolehDibuka({ status: 'PROBATION', phase: 'DURING' });
    expect(f.terkunci.DURING).toBe(false);
  });

  it('pegawai pasca-kerja tidak dikunci', () => {
    expect(wajibSelesaikanPraKerja({ status: 'RESIGNED', phase: 'POST' })).toBe(false);
    expect(wajibSelesaikanPraKerja({ status: 'RETIRED', phase: 'POST' })).toBe(false);
  });

  it('status kosong tidak dikunci (data belum termuat)', () => {
    expect(wajibSelesaikanPraKerja({})).toBe(false);
    expect(wajibSelesaikanPraKerja({ status: null })).toBe(false);
  });
});
