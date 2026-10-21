/**
 * Daily Performance Index — PRD v2.0 §4.3.
 * Fungsi murni: tanpa I/O, tanpa database, agar setiap aturan dapat diuji
 * langsung dan dipakai ulang oleh snapshot harian maupun rekap.
 */
export type TrafficLight = 'GREEN' | 'YELLOW' | 'RED' | 'NO_DATA';
export type Direction = 'HIGHER_BETTER' | 'LOWER_BETTER';
export type AttendanceSignal = 'PRESENT' | 'LATE' | 'ABSENT';

export interface DpiIndicator {
  id: string;
  weight: number;
  target: number;
  actual: number | null;
  direction: Direction;
}

export interface DpiResult {
  score: number | null;
  filled: number;
  expected: number;
  weakest: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Rasio capaian; null berarti indikator belum diukur (bukan nol). */
export function achievementRatio(ind: DpiIndicator): number | null {
  if (ind.actual === null || ind.actual === undefined) return null;
  if (!Number.isFinite(ind.actual) || !Number.isFinite(ind.target)) return null;
  if (ind.target <= 0 || ind.weight <= 0) return null;
  if (ind.direction === 'HIGHER_BETTER') return ind.actual / ind.target;
  // LOWER_BETTER: actual 0 adalah hasil terbaik; 0.01 menjaga pembagi tetap
  // hingga rasio besar lalu dipotong oleh cap.
  return ind.target / Math.max(ind.actual, 0.01);
}

export function computeDpi(indicators: DpiIndicator[], cap = 1.2): DpiResult {
  const countable = indicators.filter((i) => i.weight > 0);
  const expected = countable.length;

  let weighted = 0;
  let weightSum = 0;
  let filled = 0;
  let weakest: string | null = null;
  let weakestRatio = Infinity;

  for (const ind of countable) {
    const raw = achievementRatio(ind);
    if (raw === null) continue;
    const ratio = Math.max(0, Math.min(raw, cap));
    weighted += ind.weight * ratio;
    weightSum += ind.weight;
    filled += 1;
    if (ratio < weakestRatio) {
      weakestRatio = ratio;
      weakest = ind.id;
    }
  }

  if (filled === 0 || weightSum === 0) {
    return { score: null, filled: 0, expected, weakest: null };
  }
  return { score: round2((weighted / weightSum) * 100), filled, expected, weakest };
}

export function classifyDpi(score: number | null, green = 90, yellow = 70): TrafficLight {
  if (score === null || score === undefined || Number.isNaN(score)) return 'NO_DATA';
  if (score >= green) return 'GREEN';
  if (score >= yellow) return 'YELLOW';
  return 'RED';
}

export function applyAttendance(
  status: TrafficLight,
  attendance: AttendanceSignal,
  demote = true,
): TrafficLight {
  if (!demote || attendance !== 'ABSENT') return status;
  if (status === 'GREEN') return 'YELLOW';
  if (status === 'YELLOW') return 'RED';
  return status;
}
