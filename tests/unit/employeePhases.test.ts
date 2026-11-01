import { describe, it, expect } from 'vitest';
import {
  phaseOf,
  PHASE_LABEL,
  PHASES,
  FEATURE_PHASE,
  PHASE_TITLE,
  PHASE_SUBTITLE,
  NEXT_PHASES,
  featuresInPhase,
  isWorkPhase,
  normalizePhase,
  deriveWorkPhase,
} from '@/lib/employee/phase';

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

  it('setiap fase punya judul & subjudul kartu', () => {
    for (const phase of PHASES) {
      expect(PHASE_TITLE[phase]).toBeTruthy();
      expect(PHASE_SUBTITLE[phase]).toBeTruthy();
    }
    expect(PHASE_TITLE.POST).toBe('Fase Pasca-Kerja');
  });

  it('panel rekrutmen & MPP berada di fase Pra-Kerja', () => {
    for (const f of [
      'mpp',
      'recruitment',
      'job-posting',
      'interview',
      'technical-test',
      'registration',
      'document-verification',
      'onboarding',
    ]) {
      expect(phaseOf(f)).toBe('PRE');
    }
  });

  it('panel administrasi kepegawaian tidak lagi nyasar ke Pra-Kerja', () => {
    for (const f of [
      'manager-assignment',
      'leave',
      'payroll',
      'e-letter',
      'policy',
      'bpjs',
      'disciplinary',
      'career-ladder',
    ]) {
      expect(phaseOf(f)).toBe('DURING');
    }
  });

  it('clearance & ringkasan SDM berada di fase Pasca-Kerja', () => {
    expect(phaseOf('clearance')).toBe('POST');
    expect(phaseOf('hr-dashboard')).toBe('POST');
  });

  it('featuresInPhase mengembalikan hanya fitur fase tersebut', () => {
    expect(featuresInPhase('PRE')).toContain('mpp');
    expect(featuresInPhase('PRE')).not.toContain('payroll');
    expect(featuresInPhase('POST')).toEqual(
      Object.keys(FEATURE_PHASE).filter((f) => FEATURE_PHASE[f] === 'POST'),
    );
  });

  it('peta fitur bersifat read-only', () => {
    expect(Object.isFrozen(FEATURE_PHASE)).toBe(true);
  });

  it('state machine hanya boleh maju satu fase', () => {
    expect(NEXT_PHASES.PRE).toEqual(['DURING']);
    expect(NEXT_PHASES.DURING).toEqual(['POST']);
    expect(NEXT_PHASES.POST).toEqual([]);
  });

  it('isWorkPhase & normalizePhase menormalkan nilai longgar', () => {
    expect(isWorkPhase('PRE')).toBe(true);
    expect(isWorkPhase('pre')).toBe(false);
    expect(normalizePhase('pre')).toBe('PRE');
    expect(normalizePhase('during')).toBe('DURING');
    expect(normalizePhase(' post ')).toBe('POST');
    expect(normalizePhase(null)).toBe('PRE');
    expect(normalizePhase('ngawur', 'DURING')).toBe('DURING');
  });
});

describe('deriveWorkPhase', () => {
  it('offboarding aktif → POST', () => {
    expect(deriveWorkPhase({ offboardingStatus: 'INITIATED', status: 'PERMANENT' })).toBe('POST');
  });

  it('program onboarding berjalan → PRE', () => {
    expect(
      deriveWorkPhase({ programStatus: 'IN_PROGRESS', probationPassed: false, status: 'PERMANENT' }),
    ).toBe('PRE');
  });

  it('program onboarding COMPLETED → DURING', () => {
    expect(deriveWorkPhase({ programStatus: 'COMPLETED', status: 'PERMANENT' })).toBe('DURING');
  });

  it('3 milestone lengkap → DURING', () => {
    expect(
      deriveWorkPhase({ programStatus: 'IN_PROGRESS', milestonesDone: 3, status: 'PERMANENT' }),
    ).toBe('DURING');
  });

  it('probation lulus → DURING walau program masih berjalan', () => {
    expect(
      deriveWorkPhase({ programStatus: 'IN_PROGRESS', probationPassed: true, status: 'PERMANENT' }),
    ).toBe('DURING');
  });

  it('probation tanpa program onboarding → PRE', () => {
    expect(deriveWorkPhase({ probationPassed: false, status: 'PROBATION' })).toBe('PRE');
  });

  it('tanpa sinyal apa pun → DURING', () => {
    expect(deriveWorkPhase({})).toBe('DURING');
  });
});
