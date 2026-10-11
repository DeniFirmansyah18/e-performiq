// SOP & SLA Compliance Scoring Engine (PRD §3.2 DUR-02, bobot 20%).
// Fungsi murni — mudah dites. Skor 0-100.

export interface SopMetrics {
  totalAssignedTasks: number;
  tasksOnTime: number;
  errorCount: number;
  fatalErrorCount: number;
}

export interface SopScoreResult {
  slaRate: number;
  errorRate: number;
  baseScore: number;
  fatalPenalty: number;
  score: number;
}

/**
 * sopScore = clamp(100*(0.6*slaRate + 0.4*(1-errorRate)) - fatalPenalty, 0, 100)
 * - slaRate = onTime/total (target ≥ 0.98)
 * - errorRate = errorCount/total
 * - fatalPenalty = min(50, fatal*10) → fatal error memotong sampai 50 poin
 */
export function computeSopScore(m: SopMetrics): SopScoreResult {
  const total = Math.max(0, m.totalAssignedTasks);
  if (total === 0) {
    return { slaRate: 0, errorRate: 0, baseScore: 0, fatalPenalty: 0, score: 0 };
  }

  const onTime = Math.min(Math.max(0, m.tasksOnTime), total);
  const slaRate = onTime / total;
  const errorRate = Math.min(1, Math.max(0, m.errorCount) / total);
  const fatalPenalty = Math.min(50, Math.max(0, m.fatalErrorCount) * 10);

  const baseScore = 100 * (0.6 * slaRate + 0.4 * (1 - errorRate));
  const score = Math.min(100, Math.max(0, baseScore - fatalPenalty));

  return {
    slaRate: Number(slaRate.toFixed(4)),
    errorRate: Number(errorRate.toFixed(4)),
    baseScore: Number(baseScore.toFixed(2)),
    fatalPenalty: Number(fatalPenalty.toFixed(2)),
    score: Number(score.toFixed(2)),
  };
}
