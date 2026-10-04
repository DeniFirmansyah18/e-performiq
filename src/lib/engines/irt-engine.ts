/**
 * IRT Engine — Item Response Theory 2PL/3PL (WS-3).
 *
 * Murni/deterministik, tanpa I/O:
 *  - `probability`: fungsi respons 3PL c + (1-c)/(1+exp(-a(θ-b))).
 *  - `itemInformation` / `testInformation`: informasi Fisher.
 *  - `estimateTheta`: EAP atas grid kuadratur θ∈[-4,4] dengan prior N(0,1);
 *    fallback MLE (argmax grid) bila likelihood nol di mana-mana.
 *  - `thetaToScore`: CDF normal baku → persentil 0..100.
 */

export interface IrtItem {
  a: number;
  b: number;
  c?: number;
}

export type ThetaMethod = 'EAP' | 'MLE';

/** Batasi tebakan semu ke rentang wajar 0..0.35. */
function clampC(c: number | undefined): number {
  if (c == null || Number.isNaN(c)) return 0;
  return Math.max(0, Math.min(0.35, c));
}

/** Peluang menjawab benar pada kemampuan θ (3PL; 2PL bila c=0). */
export function probability(theta: number, item: IrtItem): number {
  const c = clampC(item.c);
  const a = Number.isFinite(item.a) ? item.a : 0;
  const z = a * (theta - item.b);
  // Stabil untuk |z| besar.
  const logistic = z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
  const p = c + (1 - c) * logistic;
  return Math.max(0, Math.min(1, p));
}

/** Informasi Fisher sebuah item pada θ. */
export function itemInformation(theta: number, item: IrtItem): number {
  const c = clampC(item.c);
  const a = Number.isFinite(item.a) ? item.a : 0;
  if (a === 0) return 0;
  const p = probability(theta, item);
  if (p <= 0 || p >= 1) return 0;
  if (c === 0) {
    return a * a * p * (1 - p);
  }
  const ratio = (p - c) / (1 - c);
  return a * a * ratio * ratio * ((1 - p) / p);
}

/** Informasi tes = jumlah informasi item. */
export function testInformation(theta: number, items: IrtItem[]): number {
  return items.reduce((s, it) => s + itemInformation(theta, it), 0);
}

// Grid kuadratur EAP: θ ∈ [-4, 4] langkah 0.1.
const GRID_MIN = -4;
const GRID_MAX = 4;
const GRID_STEP = 0.1;

function gridPoints(): number[] {
  const pts: number[] = [];
  for (let t = GRID_MIN; t <= GRID_MAX + 1e-9; t += GRID_STEP) {
    pts.push(Math.round(t * 10) / 10);
  }
  return pts;
}

/** Prior N(0,1) (konstanta normalisasi diabaikan — proporsional saja). */
function priorDensity(theta: number): number {
  return Math.exp(-0.5 * theta * theta);
}

function clampTheta(t: number): number {
  if (!Number.isFinite(t)) return 0;
  return Math.max(-4, Math.min(4, t));
}

/**
 * Estimasi kemampuan laten θ dari respons biner 0/1.
 * Aman untuk pola ekstrem (semua benar/salah → θ terbatas via prior).
 */
export function estimateTheta(
  responses: Array<0 | 1>,
  items: IrtItem[],
): { theta: number; se: number; method: ThetaMethod } {
  const n = Math.min(responses.length, items.length);
  if (n === 0) return { theta: 0, se: 1, method: 'EAP' };

  const pts = gridPoints();
  const post = pts.map((t) => {
    let like = 1;
    for (let i = 0; i < n; i++) {
      const p = probability(t, items[i]);
      const peps = Math.max(1e-12, Math.min(1 - 1e-12, p));
      like *= responses[i] === 1 ? peps : 1 - peps;
      if (like === 0) break;
    }
    return priorDensity(t) * like;
  });

  const total = post.reduce((s, v) => s + v, 0);
  if (total <= 0 || !Number.isFinite(total)) {
    // Fallback MLE: argmax log-likelihood pada grid.
    let best = 0;
    let bestLl = -Infinity;
    for (const t of pts) {
      let ll = 0;
      for (let i = 0; i < n; i++) {
        const p = probability(t, items[i]);
        const peps = Math.max(1e-12, Math.min(1 - 1e-12, p));
        ll += responses[i] === 1 ? Math.log(peps) : Math.log(1 - peps);
      }
      if (ll > bestLl) {
        bestLl = ll;
        best = t;
      }
    }
    return { theta: clampTheta(best), se: 1, method: 'MLE' };
  }

  const mean = pts.reduce((s, t, i) => s + t * (post[i] / total), 0);
  const variance = pts.reduce((s, t, i) => s + (t - mean) * (t - mean) * (post[i] / total), 0);
  return { theta: clampTheta(mean), se: Math.sqrt(Math.max(0, variance)), method: 'EAP' };
}

/** erf (Abramowitz-Stegun 7.1.26), |ε| ≤ 1.5e-7. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

/** CDF normal baku. */
function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

/** Petakan θ → skor 0..100 via persentil normal baku. */
export function thetaToScore(theta: number): number {
  if (!Number.isFinite(theta)) return 50;
  const p = normalCdf(Math.max(-4, Math.min(4, theta)));
  return Math.max(0, Math.min(100, Math.round(p * 100 * 100) / 100));
}

/** Skor satu langkah: respons biner + parameter item → θ + skor 0..100. */
export function scoreIrt(
  responses: Array<0 | 1>,
  items: IrtItem[],
): { theta: number; score0to100: number; information: number } {
  const { theta } = estimateTheta(responses, items);
  return {
    theta,
    score0to100: thetaToScore(theta),
    information: testInformation(theta, items),
  };
}
