import { describe, it, expect } from 'vitest';
import { keteranganStatus } from '@/lib/recruitment/statusLabel';

describe('keterangan status lamaran', () => {
  it('OFFERED tanpa respon -> Menunggu respons', () => {
    expect(keteranganStatus('OFFERED', null)).toBe('Menunggu respons');
    expect(keteranganStatus('OFFERED', 'SENT')).toBe('Menunggu respons');
  });

  it('OFFERED + kandidat menerima -> Ditawar — Diterima', () => {
    expect(keteranganStatus('OFFERED', 'ACCEPTED')).toBe('Ditawar — Diterima');
  });

  it('OFFERED + kandidat menolak -> Ditawar — Ditolak', () => {
    expect(keteranganStatus('OFFERED', 'DECLINED')).toBe('Ditawar — Ditolak');
  });

  it('HIRED dan REJECTED punya keterangan sendiri', () => {
    expect(keteranganStatus('HIRED', null)).toBeTruthy();
    expect(keteranganStatus('REJECTED', null)).toBeTruthy();
    expect(keteranganStatus('HIRED', null)).not.toBe(keteranganStatus('REJECTED', null));
  });

  it('status awal tidak menampilkan keterangan kosong yang menyesatkan', () => {
    // Status sebelum penawaran tidak perlu label tambahan.
    expect(keteranganStatus('SUBMITTED', null)).toBeNull();
    expect(keteranganStatus('SCREENING', null)).toBeNull();
    expect(keteranganStatus('INTERVIEW', null)).toBeNull();
  });
});
