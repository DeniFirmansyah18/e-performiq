// Competency -> GPA score engine (DUR-03). Menurunkan skor kompetensi 0-100 dari
// level kompetensi, total gap, dan jam pelatihan. Bobot/ambang dapat dikonfigurasi.
export interface CompetencyGpaInput {
  competencyLevels: number[];
  gapSum: number;
  trainingHours: number;
  cfg?: { targetHours?: number; gapPenaltyPerPoint?: number };
}

export function deriveCompetencyScore(input: CompetencyGpaInput): number {
  const targetHours = input.cfg?.targetHours ?? 24;
  const gapPenalty = input.cfg?.gapPenaltyPerPoint ?? 5;
  const levels = input.competencyLevels ?? [];
  const avgLevel = levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : 0;
  const levelComponent = (avgLevel / 5) * 20;
  const hoursComponent = targetHours > 0 ? Math.min(input.trainingHours / targetHours, 1) * 10 : 0;
  const raw = 70 + levelComponent - input.gapSum * gapPenalty + hoursComponent;
  return Number(Math.min(100, Math.max(0, raw)).toFixed(2));
}
