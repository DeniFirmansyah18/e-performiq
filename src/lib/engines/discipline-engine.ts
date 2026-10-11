// Discipline Factor Engine (PRD §3.2 DUR-02 sub-matriks, keputusan D3).
// Kehadiran MENGURANGI skor SOP lewat faktor, bobot komposit tetap 50/20/15/15.
// Fungsi murni.

export const BRADFORD_THRESHOLD = 45; // PRD: Bradford < 45
export const LATE_RATE_TARGET = 0.005; // PRD: keterlambatan < 0.5%

export interface DisciplineInput {
  lateCount: number;
  workDays: number;
  bradford: number;
}

export interface DisciplineResult {
  lateRate: number;
  bradfordExcess: number;
  penalty: number;
  factor: number; // 0.6 - 1.0
  notes: string;
}

/**
 * factor = clamp(1 - penalty, 0.6, 1)
 * penalty = min(0.15, lateRate*10) + min(0.15, bradfordExcess)
 * bradfordExcess = max(0, (bradford-45)/45)
 */
export function computeDisciplineFactor(input: DisciplineInput): DisciplineResult {
  const workDays = Math.max(0, input.workDays);
  const lateRate = workDays > 0 ? Math.max(0, input.lateCount) / workDays : 0;
  const bradfordExcess = Math.max(0, (Math.max(0, input.bradford) - BRADFORD_THRESHOLD) / BRADFORD_THRESHOLD);

  const latePenalty = Math.min(0.15, lateRate * 10);
  const bradfordPenalty = Math.min(0.15, bradfordExcess);
  const penalty = latePenalty + bradfordPenalty;
  const factor = Math.min(1, Math.max(0.6, 1 - penalty));

  const parts: string[] = [];
  if (input.lateCount > 0) parts.push(`${input.lateCount} hari telat (rate ${(lateRate * 100).toFixed(1)}%)`);
  if (bradfordExcess > 0) parts.push(`Bradford ${input.bradford} (> ${BRADFORD_THRESHOLD})`);
  const notes = parts.length > 0 ? parts.join(', ') : 'Kehadiran bersih';

  return {
    lateRate: Number(lateRate.toFixed(4)),
    bradfordExcess: Number(bradfordExcess.toFixed(4)),
    penalty: Number(penalty.toFixed(4)),
    factor: Number(factor.toFixed(4)),
    notes,
  };
}
