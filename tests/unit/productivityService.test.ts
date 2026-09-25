import { describe, it, expect } from 'vitest';
import { generateTalentRecommendationSignal } from '@/lib/services/productivityService';

describe('Kotak 1: Productivity & Recommendation Engine', () => {
  it('merekomendasikan PROMOTION jika talenta memiliki GPA >= 3.70 dan berada di Box 9 (FUTURE_LEADER)', () => {
    const signal = generateTalentRecommendationSignal({
      gpa: 3.85,
      nineBox: 'FUTURE_LEADER',
      attendanceBradford: 10,
    });
    expect(signal.action).toBe('PROMOTION');
    expect(signal.badgeColor).toContain('emerald');
  });

  it('merekomendasikan MUTATION jika talenta berada di Box 7 (ENIGMA)', () => {
    const signal = generateTalentRecommendationSignal({
      gpa: 2.30,
      nineBox: 'ENIGMA',
      attendanceBradford: 20,
    });
    expect(signal.action).toBe('MUTATION');
    expect(signal.reason).toContain('salah penempatan');
  });

  it('merekomendasikan PIP 60 hari jika talenta memiliki GPA < 2.00 atau Box 1 (UNDERPERFORMER)', () => {
    const signal = generateTalentRecommendationSignal({
      gpa: 1.80,
      nineBox: 'UNDERPERFORMER',
      attendanceBradford: 85,
    });
    expect(signal.action).toBe('PIP');
    expect(signal.durationDays).toBe(60);
  });
});
