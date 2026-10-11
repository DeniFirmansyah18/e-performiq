// Training Effectiveness Engine (Kirkpatrick L2/L3) — PRD §3.2 delta ≥ +25%.
// Fungsi murni.

export const MIN_DELTA_PCT = 25; // PRD target

export interface TrainingDelta {
  pre: number;
  post: number;
  deltaPct: number;
  meetsTarget: boolean;
}

export function computeTrainingDelta(pre: number, post: number): TrainingDelta {
  const p = Math.max(0, pre);
  const q = Math.max(0, post);
  // Hindari bagi nol: bila pre 0, gunakan selisih absolut sebagai delta.
  const deltaPct = p > 0 ? ((q - p) / p) * 100 : q;
  return {
    pre: p,
    post: q,
    deltaPct: Number(deltaPct.toFixed(2)),
    meetsTarget: deltaPct >= MIN_DELTA_PCT,
  };
}
