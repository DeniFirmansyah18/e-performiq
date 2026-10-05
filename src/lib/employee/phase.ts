/** Pemetaan fitur employee-portal ke fase siklus kerja. */
export type WorkPhase = 'PRE' | 'DURING' | 'POST';

const MAP: Record<string, WorkPhase> = {
  onboarding: 'PRE',
  scorecard: 'DURING',
  okr: 'DURING',
  development: 'DURING',
  timesheet: 'DURING',
  payslip: 'DURING',
  career: 'DURING',
  reimbursement: 'DURING',
  helpdesk: 'DURING',
  evidence: 'DURING',
  jobboard: 'DURING',
  profile: 'DURING',
  attendance: 'DURING',
  offboarding: 'POST',
};

export function phaseOf(feature: string): WorkPhase {
  return MAP[feature] ?? 'DURING';
}

export const PHASE_LABEL: Record<WorkPhase, string> = {
  PRE: 'Sebelum Kerja',
  DURING: 'Saat Kerja',
  POST: 'Setelah Kerja',
};

export const PHASES: WorkPhase[] = ['PRE', 'DURING', 'POST'];
