import { describe, it, expect } from 'vitest';
import { labelPerspektif, LABEL_PERSPEKTIF } from '@/lib/performance/perspectiveLabel';

describe('labelPerspektif', () => {
  it('mengubah kode teknis BSC menjadi bahasa manusia', () => {
    expect(labelPerspektif('FINANCIAL')).toBe('Keuangan');
    expect(labelPerspektif('CUSTOMER')).toBe('Pelanggan');
    expect(labelPerspektif('INTERNAL_PROCESS')).toBe('Proses Internal');
    expect(labelPerspektif('LEARNING_GROWTH')).toBe('Pembelajaran & Pertumbuhan');
  });

  it('tidak peka huruf besar/kecil dan spasi', () => {
    expect(labelPerspektif(' customer ')).toBe('Pelanggan');
  });

  it('string kosong menjadi kosong', () => {
    expect(labelPerspektif('')).toBe('');
    expect(labelPerspektif(null)).toBe('');
    expect(labelPerspektif(undefined)).toBe('');
  });

  it('kode tak dikenal dikembalikan apa adanya (bukan disembunyikan)', () => {
    expect(labelPerspektif('SOMETHING_NEW')).toBe('SOMETHING_NEW');
  });

  it('seluruh kode enum BSC punya label', () => {
    for (const kode of ['FINANCIAL', 'CUSTOMER', 'INTERNAL_PROCESS', 'LEARNING_GROWTH']) {
      expect(LABEL_PERSPEKTIF[kode]).toBeTruthy();
    }
  });
});
