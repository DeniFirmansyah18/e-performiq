// Completion Engine — mengadopsi logika completion tracking Moodle
// (completion/progress.php: completed/total*100).
export type CompletionState = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE';

export function computeCourseProgress(items: { completed: boolean }[]): number {
  if (!items || items.length === 0) return 0;
  const done = items.filter((i) => i.completed).length;
  return Number(((done / items.length) * 100).toFixed(2));
}

export function resolveCompletionState(progressPct: number, _rule: 'ALL' | 'ANY' = 'ALL'): CompletionState {
  if (progressPct <= 0) return 'NOT_STARTED';
  if (progressPct >= 100) return 'COMPLETE';
  return 'IN_PROGRESS';
}
