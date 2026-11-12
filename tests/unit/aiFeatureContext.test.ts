import { describe, it, expect } from 'vitest';
import { fiturKonteksAi } from '@/lib/ai/featureContext';

describe('konteks AI per menu', () => {
  it('menu rekrutmen memakai konteks karier', () => {
    expect(fiturKonteksAi('recruitment')).toBe('careers');
    expect(fiturKonteksAi('interview')).toBe('careers');
  });

  it('menu pembelajaran memakai konteks learning', () => {
    expect(fiturKonteksAi('learning')).toBe('learning');
  });

  it('menu manajerial memakai konteks manager', () => {
    expect(fiturKonteksAi('manager-assignment')).toBe('manager');
    expect(fiturKonteksAi('leave')).toBe('manager');
  });

  it('menu wawasan memakai konteks executive', () => {
    expect(fiturKonteksAi('cost')).toBe('executive');
    expect(fiturKonteksAi('retirement')).toBe('executive');
  });

  it('menu tanpa pemetaan tetap mendapat konteks (bukan kosong)', () => {
    // Wajib ada konteks agar analisis tidak gagal; jatuh ke konteks umum HR.
    expect(fiturKonteksAi('menu-tidak-dikenal')).toBe('hr');
    expect(fiturKonteksAi('')).toBe('hr');
  });

  it('semua hasil pemetaan adalah konteks yang dikenal server', () => {
    const dikenal = ['executive', 'hr', 'manager', 'ninebox', 'employee', 'learning', 'careers', 'board', 'audit'];
    const menu = ['recruitment', 'interview', 'technical-test', 'registration', 'document-verification',
      'learning', 'pipeline', 'career-ladder', 'scorecard', 'manager-assignment', 'leave',
      'hr-dashboard', 'mpp', 'cost', 'iso-30414', 'retirement', 'alumni', 'exit-analytics', 'bpjs', 'payroll'];
    for (const m of menu) {
      expect(dikenal, `konteks untuk ${m}`).toContain(fiturKonteksAi(m));
    }
  });
});
