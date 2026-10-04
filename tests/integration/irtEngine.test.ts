import { describe, it, expect } from 'vitest';
import { probability, itemInformation, testInformation, estimateTheta, thetaToScore, scoreIrt } from '@/lib/engines/irt-engine';

describe('IRT engine', () => {
  it('2PL probability monotone naik terhadap theta', () => {
    const it = { a: 1.2, b: 0.0 };
    expect(probability(-3, it)).toBeLessThan(probability(0, it));
    expect(probability(0, it)).toBeCloseTo(0.5, 5);
    expect(probability(3, it)).toBeGreaterThan(probability(0, it));
  });

  it('3PL mendekati c saat theta sangat rendah', () => {
    const it = { a: 1.0, b: 0.0, c: 0.2 };
    expect(probability(-6, it)).toBeCloseTo(0.2, 2);
  });

  it('informasi item positif & informasi tes = jumlah', () => {
    const items = [{ a: 1, b: -1 }, { a: 1, b: 0 }, { a: 1, b: 1 }];
    expect(itemInformation(0, items[0])).toBeGreaterThan(0);
    const sum = items.reduce((s, it) => s + itemInformation(0, it), 0);
    expect(testInformation(0, items)).toBeCloseTo(sum, 8);
  });

  it('EAP: pola semua benar → theta tinggi; semua salah → rendah', () => {
    const items = [{ a: 1, b: -1 }, { a: 1, b: 0 }, { a: 1, b: 1 }];
    const hi = estimateTheta([1, 1, 1], items);
    const lo = estimateTheta([0, 0, 0], items);
    expect(hi.theta).toBeGreaterThan(0.5);
    expect(lo.theta).toBeLessThan(-0.5);
    expect(Number.isFinite(hi.theta)).toBe(true);
    expect(Number.isFinite(lo.theta)).toBe(true);
    expect(hi.method).toBe('EAP');
  });

  it('thetaToScore memetakan 0 → ~50, monoton', () => {
    expect(thetaToScore(0)).toBeCloseTo(50, 0);
    expect(thetaToScore(2)).toBeGreaterThan(thetaToScore(0));
    expect(thetaToScore(-2)).toBeLessThan(thetaToScore(0));
  });

  it('scoreIrt: deterministik & 0..100', () => {
    const items = [{ a: 1, b: 0 }, { a: 1, b: 0.5 }, { a: 1, b: -0.5 }];
    const a = scoreIrt([1, 0, 1], items);
    const b = scoreIrt([1, 0, 1], items);
    expect(a).toEqual(b);
    expect(a.score0to100).toBeGreaterThanOrEqual(0);
    expect(a.score0to100).toBeLessThanOrEqual(100);
  });
});
