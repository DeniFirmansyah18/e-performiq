// Badge Award Engine — mengadopsi aturan kriteria badge Moodle (COURSE/COMPETENCY/COURSESET).
export type BadgeCriterion = {
  criteriaType: 'COURSE' | 'COMPETENCY' | 'COURSESET';
  courseId?: number;
  competencyId?: string;
  minLevel?: number;
};
export type BadgeContext = { completedCourseIds: number[]; competencyLevels: Record<string, number> };

export function evaluateBadgeCriteria(criteria: BadgeCriterion[], ctx: BadgeContext): boolean {
  if (!criteria || criteria.length === 0) return false;
  return criteria.every((c) => {
    if (c.criteriaType === 'COURSE') return ctx.completedCourseIds.includes(Number(c.courseId));
    if (c.criteriaType === 'COMPETENCY') return (ctx.competencyLevels[c.competencyId ?? ''] ?? 0) >= (c.minLevel ?? 1);
    return true;
  });
}
