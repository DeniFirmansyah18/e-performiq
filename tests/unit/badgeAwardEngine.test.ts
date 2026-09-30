import { describe, it, expect } from 'vitest';
import { evaluateBadgeCriteria } from '@/lib/engines/badge-award-engine';

describe('badge-award-engine', () => {
  const ctx = { completedCourseIds: [101, 102], competencyLevels: { 'c-cloud': 4 } };
  it('COURSE terpenuhi bila course selesai', () => {
    expect(evaluateBadgeCriteria([{ criteriaType: 'COURSE', courseId: 101 }], ctx)).toBe(true);
    expect(evaluateBadgeCriteria([{ criteriaType: 'COURSE', courseId: 999 }], ctx)).toBe(false);
  });
  it('COMPETENCY terpenuhi bila level >= minLevel', () => {
    expect(evaluateBadgeCriteria([{ criteriaType: 'COMPETENCY', competencyId: 'c-cloud', minLevel: 3 }], ctx)).toBe(true);
    expect(evaluateBadgeCriteria([{ criteriaType: 'COMPETENCY', competencyId: 'c-cloud', minLevel: 5 }], ctx)).toBe(false);
  });
  it('COURSESET butuh SEMUA course', () => {
    expect(evaluateBadgeCriteria([
      { criteriaType: 'COURSE', courseId: 101 }, { criteriaType: 'COURSE', courseId: 102 },
    ], ctx)).toBe(true);
    expect(evaluateBadgeCriteria([
      { criteriaType: 'COURSE', courseId: 101 }, { criteriaType: 'COURSE', courseId: 777 },
    ], ctx)).toBe(false);
  });
  it('kriteria kosong -> false', () => {
    expect(evaluateBadgeCriteria([], ctx)).toBe(false);
  });
});
