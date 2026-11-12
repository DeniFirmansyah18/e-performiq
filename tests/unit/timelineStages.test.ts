import { describe, it, expect } from 'vitest';
import { STAGE_ORDER, STAGE_LABEL } from '@/lib/services/timelineService';

describe('tahapan timeline kandidat setelah review HR dihapus', () => {
  it('tidak lagi memuat tahap HR_REVIEW', () => {
    expect(STAGE_ORDER).not.toContain('HR_REVIEW');
    expect(Object.keys(STAGE_LABEL)).not.toContain('HR_REVIEW');
  });

  it('urutannya: lamar -> seleksi berkas -> psikotes -> teknis -> wawancara -> keputusan akhir', () => {
    expect(STAGE_ORDER).toEqual([
      'APPLIED', 'ATS_REVIEW', 'PSYCHOMETRIC', 'TECHNICAL', 'INTERVIEW', 'DECISION',
    ]);
  });

  it('keputusan akhir tetap menjadi tahap terakhir', () => {
    expect(STAGE_ORDER[STAGE_ORDER.length - 1]).toBe('DECISION');
  });

  it('tiap tahap punya label Bahasa Indonesia', () => {
    for (const s of STAGE_ORDER) {
      expect(STAGE_LABEL[s], `label untuk ${s}`).toBeTruthy();
    }
  });
});
