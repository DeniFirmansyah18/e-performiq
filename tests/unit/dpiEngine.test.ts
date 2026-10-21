import { describe, it, expect } from 'vitest';
import { achievementRatio, computeDpi, classifyDpi, applyAttendance } from '@/lib/engines/dpiEngine';

const ind = (over: Partial<Parameters<typeof achievementRatio>[0]> = {}) => ({
  id: 'i1', weight: 100, target: 10, actual: 8, direction: 'HIGHER_BETTER' as const, ...over,
});

describe('dpiEngine', () => {
  it('HIGHER_BETTER: 8 dari target 10 = 0.8', () => {
    expect(achievementRatio(ind())).toBeCloseTo(0.8, 4);
  });

  it('LOWER_BETTER: actual 0 tidak pernah Infinity', () => {
    const r = achievementRatio(ind({ direction: 'LOWER_BETTER', actual: 0, target: 2 }));
    expect(Number.isFinite(r!)).toBe(true);
    expect(r!).toBeGreaterThan(1);
  });

  it('tanpa entri sama sekali → NO_DATA, bukan 0', () => {
    const res = computeDpi([]);
    expect(res.score).toBeNull();
    expect(classifyDpi(res.score)).toBe('NO_DATA');
  });

  it('hanya menghitung indikator yang terisi, bobot ternormalisasi', () => {
    const res = computeDpi([
      ind({ id: 'a', weight: 50, actual: 10 }),
      ind({ id: 'b', weight: 50, actual: null }),
    ]);
    expect(res.score).toBeCloseTo(100, 2);
    expect(res.filled).toBe(1);
    expect(res.expected).toBe(2);
  });

  it('cap 1.2 mencegah satu indikator menutupi yang lain', () => {
    // Ruling R2: (50*1.2 + 50*0.1) / 100 * 100 = 65, not 60.
    const res = computeDpi([
      ind({ id: 'a', weight: 50, actual: 100 }),
      ind({ id: 'b', weight: 50, actual: 1 }),
    ]);
    expect(res.score).toBeCloseTo(65, 2);
  });

  it('ambang 90/70', () => {
    expect(classifyDpi(90)).toBe('GREEN');
    expect(classifyDpi(89.99)).toBe('YELLOW');
    expect(classifyDpi(70)).toBe('YELLOW');
    expect(classifyDpi(69.99)).toBe('RED');
  });

  it('alpa menurunkan satu tingkat, tidak pernah menaikkan', () => {
    expect(applyAttendance('GREEN', 'ABSENT')).toBe('YELLOW');
    expect(applyAttendance('YELLOW', 'ABSENT')).toBe('RED');
    expect(applyAttendance('RED', 'ABSENT')).toBe('RED');
    expect(applyAttendance('NO_DATA', 'ABSENT')).toBe('NO_DATA');
    expect(applyAttendance('GREEN', 'ABSENT', false)).toBe('GREEN');
    expect(applyAttendance('GREEN', 'LATE')).toBe('GREEN');
  });

  it('indikator terlemah dilaporkan', () => {
    const res = computeDpi([
      ind({ id: 'a', weight: 50, actual: 10 }),
      ind({ id: 'b', weight: 50, actual: 2 }),
    ]);
    expect(res.weakest).toBe('b');
  });
});
