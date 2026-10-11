import { describe, it, expect } from 'vitest';
import { computeTrainingDelta, MIN_DELTA_PCT } from '@/lib/engines/training-effectiveness-engine';

describe('training-effectiveness-engine', () => {
  it('delta positif memenuhi target', () => {
    const r = computeTrainingDelta(60, 80);
    expect(r.deltaPct).toBeCloseTo(33.33, 1);
    expect(r.meetsTarget).toBe(true);
  });
  it('delta kecil tidak memenuhi target', () => {
    const r = computeTrainingDelta(60, 65);
    expect(r.meetsTarget).toBe(false);
  });
  it('pre=0 pakai selisih absolut (hindari bagi nol)', () => {
    const r = computeTrainingDelta(0, 30);
    expect(r.deltaPct).toBe(30);
    expect(r.meetsTarget).toBe(true);
  });
  it('ambang tepat = MIN_DELTA_PCT dianggap lulus', () => {
    const r = computeTrainingDelta(100, 100 + MIN_DELTA_PCT);
    expect(r.meetsTarget).toBe(true);
  });
  it('null-safe: input negatif dijepit ke 0', () => {
    const r = computeTrainingDelta(-5, -10);
    expect(r.pre).toBe(0);
    expect(r.post).toBe(0);
  });
});
