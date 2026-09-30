import { describe, it, expect } from 'vitest';
import { computeCourseProgress, resolveCompletionState } from '@/lib/engines/completion-engine';

describe('completion-engine', () => {
  it('menghitung progress sebagai persentase modul selesai', () => {
    expect(computeCourseProgress([{ completed: true }, { completed: false }, { completed: true }, { completed: false }])).toBe(50);
  });
  it('mengembalikan 0 untuk daftar kosong (tidak NaN)', () => {
    expect(computeCourseProgress([])).toBe(0);
  });
  it('menentukan state NOT_STARTED / IN_PROGRESS / COMPLETE', () => {
    expect(resolveCompletionState(0, 'ALL')).toBe('NOT_STARTED');
    expect(resolveCompletionState(50, 'ALL')).toBe('IN_PROGRESS');
    expect(resolveCompletionState(100, 'ALL')).toBe('COMPLETE');
  });
});
