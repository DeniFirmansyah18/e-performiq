// Competency Evidence Engine — mengadopsi competency rating & skill gap.
export function deriveCompetencyRating(evidence: { rating: number }[]): number {
  if (!evidence || evidence.length === 0) return 0;
  const avg = evidence.reduce((s, e) => s + e.rating, 0) / evidence.length;
  return Math.min(5, Math.max(1, Math.round(avg)));
}

export function computeSkillGap(required: number, actual: number): { gap: number; deficient: boolean } {
  const gap = required - actual;
  return { gap, deficient: gap > 0 };
}
