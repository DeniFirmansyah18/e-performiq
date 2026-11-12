import { describe, it, expect } from 'vitest';
import { detailPenawaranPublik } from '@/lib/services/offerResponseService';

describe('detail penawaran untuk halaman publik', () => {
  it('hanya memaparkan bidang yang boleh dilihat kandidat', () => {
    const sumber = {
      posisi: 'Senior Software Engineer',
      gajiPokok: 18000000,
      tunjangan: 2000000,
      batasRespons: '2026-11-20T23:59:00Z',
      keterangan: 'Benefit kesehatan dan THR',
      // Bidang internal yang TIDAK boleh ikut terkirim:
      offeredByUserId: 'user-rahasia',
      letterAgendaNumber: 'AG-001',
      statusPenawaran: 'SENT',
    };
    const hasil = detailPenawaranPublik(sumber as any);
    expect(hasil.posisi).toBe('Senior Software Engineer');
    expect(hasil.gajiPokok).toBe(18000000);
    expect(hasil.tunjangan).toBe(2000000);
    expect(hasil.batasRespons).toBe('2026-11-20T23:59:00Z');
    expect(hasil.keterangan).toBe('Benefit kesehatan dan THR');
    expect(hasil).not.toHaveProperty('offeredByUserId');
    expect(hasil).not.toHaveProperty('letterAgendaNumber');
  });

  it('mengosongkan bidang opsional dengan aman', () => {
    const hasil = detailPenawaranPublik({ posisi: 'Analis', gajiPokok: 0 } as any);
    expect(hasil.tunjangan).toBeNull();
    expect(hasil.batasRespons).toBeNull();
    expect(hasil.keterangan).toBeNull();
  });
});
