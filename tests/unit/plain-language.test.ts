import { describe, it, expect } from 'vitest';
import { PLAIN_TERMS } from '@/lib/employee/plainLanguage';

describe('plainLanguage glossary', () => {
  it('setiap istilah punya plain, technical, tooltip non-kosong', () => {
    for (const [key, t] of Object.entries(PLAIN_TERMS)) {
      expect(t.plain.length, key).toBeGreaterThan(0);
      expect(t.technical.length, key).toBeGreaterThan(0);
      expect(t.tooltip.length, key).toBeGreaterThan(0);
    }
  });
  it('GPA & KPI diberi label awam', () => {
    expect(PLAIN_TERMS.GPA.plain).toBe('Nilai Kinerja');
    expect(PLAIN_TERMS.KPI.plain).toBe('Target Kerja');
  });
});
