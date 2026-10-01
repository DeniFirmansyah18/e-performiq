import { describe, it, expect } from 'vitest';
import { deriveCompetencyScore } from '@/lib/engines/competency-gpa-engine';

describe('competency-gpa-engine', () => {
  it('skor tinggi untuk level tinggi, gap nol, jam terpenuhi', () => {
    expect(deriveCompetencyScore({ competencyLevels: [5, 5, 5, 5], gapSum: 0, trainingHours: 24 })).toBe(100);
  });
  it('penalti gap menurunkan skor', () => {
    const hi = deriveCompetencyScore({ competencyLevels: [4, 4], gapSum: 0, trainingHours: 24 });
    const lo = deriveCompetencyScore({ competencyLevels: [4, 4], gapSum: 3, trainingHours: 24 });
    expect(lo).toBeLessThan(hi);
  });
  it('null-safe: level kosong tetap finite (=70)', () => {
    expect(deriveCompetencyScore({ competencyLevels: [], gapSum: 0, trainingHours: 0 })).toBe(70);
  });
});
