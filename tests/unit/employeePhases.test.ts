import { describe, it, expect } from 'vitest';
import { phaseOf, PHASE_LABEL, PHASES } from '@/lib/employee/phase';

describe('employee phases', () => {
  it('onboarding → PRE', () => {
    expect(phaseOf('onboarding')).toBe('PRE');
  });

  it('scorecard/okr/development/timesheet/payslip/profile → DURING', () => {
    for (const f of ['scorecard', 'okr', 'development', 'timesheet', 'payslip', 'profile', 'career', 'helpdesk']) {
      expect(phaseOf(f)).toBe('DURING');
    }
  });

  it('offboarding → POST', () => {
    expect(phaseOf('offboarding')).toBe('POST');
  });

  it('fitur tak dikenal → DURING (default aman)', () => {
    expect(phaseOf('whatever')).toBe('DURING');
  });

  it('label & urutan fase', () => {
    expect(PHASE_LABEL.PRE).toBe('Sebelum Kerja');
    expect(PHASE_LABEL.DURING).toBe('Saat Kerja');
    expect(PHASE_LABEL.POST).toBe('Setelah Kerja');
    expect(PHASES).toEqual(['PRE', 'DURING', 'POST']);
  });
});
