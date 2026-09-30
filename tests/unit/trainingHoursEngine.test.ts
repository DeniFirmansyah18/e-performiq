import { describe, it, expect } from 'vitest';
import { computeTrainingHours, kirkpatrickGain } from '@/lib/engines/training-hours-engine';

describe('training-hours-engine', () => {
  it('menjumlahkan menit menjadi jam', () => {
    expect(computeTrainingHours([{ timeSpentMinutes: 60 }, { timeSpentMinutes: 90 }])).toBe(2.5);
    expect(computeTrainingHours([])).toBe(0);
  });
  it('menghitung Kirkpatrick gain (post-pre)/pre dalam persen', () => {
    expect(kirkpatrickGain(60, 80)).toBeCloseTo(33.33, 1);
    expect(kirkpatrickGain(0, 80)).toBe(0);
  });
});
