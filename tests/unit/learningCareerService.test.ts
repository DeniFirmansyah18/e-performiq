import { describe, it, expect } from 'vitest';
import { matchCoursesToSkillGaps } from '@/lib/services/learningCareerService';

describe('Kotak 2: Learning & Career Path Engine', () => {
  it('secara otomatis merekomendasikan silabus Moodle untuk gap kompetensi negatif', () => {
    const gaps = [
      { skill: 'Cloud Architecture', required: 4, actual: 2, gap: 2 },
      { skill: 'Communication', required: 4, actual: 4, gap: 0 },
    ];
    const catalog = [
      { courseId: 101, title: 'Mastering AWS & Cloud Native Architecture', targetSkill: 'Cloud Architecture' },
      { courseId: 102, title: 'Effective Communication in Agile Teams', targetSkill: 'Communication' },
    ];

    const recommended = matchCoursesToSkillGaps(gaps, catalog);
    expect(recommended).toHaveLength(1);
    expect(recommended[0].courseId).toBe(101);
  });
});
