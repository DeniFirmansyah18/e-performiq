// Training Hours & Kirkpatrick Effectiveness Engine (PRD §3.2).
export function computeTrainingHours(enrollments: { timeSpentMinutes: number }[]): number {
  if (!enrollments || enrollments.length === 0) return 0;
  const minutes = enrollments.reduce((s, e) => s + (e.timeSpentMinutes || 0), 0);
  return Number((minutes / 60).toFixed(2));
}

export function kirkpatrickGain(preScore: number, postScore: number): number {
  if (preScore <= 0) return 0;
  return Number((((postScore - preScore) / preScore) * 100).toFixed(2));
}
