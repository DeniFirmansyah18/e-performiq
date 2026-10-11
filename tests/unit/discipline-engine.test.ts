import { describe, it, expect } from 'vitest';
import { computeDisciplineFactor } from '@/lib/engines/discipline-engine';

describe('discipline-engine', () => {
  it('tanpa telat, Bradford rendah → faktor 1.0', () => {
    expect(computeDisciplineFactor({ lateCount: 0, workDays: 20, bradford: 0 }).factor).toBe(1);
  });
  it('telat berulang menurunkan faktor', () => {
    const clean = computeDisciplineFactor({ lateCount: 0, workDays: 20, bradford: 0 });
    const late = computeDisciplineFactor({ lateCount: 8, workDays: 20, bradford: 0 });
    expect(late.factor).toBeLessThan(clean.factor);
  });
  it('Bradford tinggi menurunkan faktor', () => {
    const ok = computeDisciplineFactor({ lateCount: 0, workDays: 20, bradford: 0 });
    const hi = computeDisciplineFactor({ lateCount: 0, workDays: 20, bradford: 200 });
    expect(hi.factor).toBeLessThan(ok.factor);
  });
  it('faktor terkurung 0.6-1', () => {
    const r = computeDisciplineFactor({ lateCount: 999, workDays: 1, bradford: 9999 });
    expect(r.factor).toBeGreaterThanOrEqual(0.6);
    expect(r.factor).toBeLessThanOrEqual(1);
  });
  it('null-safe: workDays 0 tidak NaN', () => {
    const r = computeDisciplineFactor({ lateCount: 0, workDays: 0, bradford: 0 });
    expect(Number.isFinite(r.factor)).toBe(true);
  });
});
