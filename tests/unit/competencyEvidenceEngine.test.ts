import { describe, it, expect } from 'vitest';
import { deriveCompetencyRating, computeSkillGap } from '@/lib/engines/competency-evidence-engine';

describe('competency-evidence-engine', () => {
  it('merata-ratakan rating evidence (dibulatkan, clamp 1..5)', () => {
    expect(deriveCompetencyRating([{ rating: 4 }, { rating: 5 }])).toBe(5);
    expect(deriveCompetencyRating([{ rating: 3 }, { rating: 3 }])).toBe(3);
    expect(deriveCompetencyRating([{ rating: 9 }])).toBe(5);
  });
  it('mengembalikan 0 untuk evidence kosong', () => {
    expect(deriveCompetencyRating([])).toBe(0);
  });
  it('menghitung gap dan status deficient', () => {
    expect(computeSkillGap(4, 3)).toEqual({ gap: 1, deficient: true });
    expect(computeSkillGap(3, 4)).toEqual({ gap: -1, deficient: false });
  });
});
