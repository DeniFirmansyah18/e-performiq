import { describe, it, expect } from 'vitest';
import { computeSopScore } from '@/lib/engines/sop-scoring-engine';

describe('sop-scoring-engine', () => {
  it('sempurna: semua tepat waktu, nol error → 100', () => {
    const r = computeSopScore({ totalAssignedTasks: 100, tasksOnTime: 100, errorCount: 0, fatalErrorCount: 0 });
    expect(r.score).toBe(100);
  });
  it('error prosedur menurunkan skor', () => {
    const clean = computeSopScore({ totalAssignedTasks: 100, tasksOnTime: 100, errorCount: 0, fatalErrorCount: 0 });
    const dirty = computeSopScore({ totalAssignedTasks: 100, tasksOnTime: 100, errorCount: 20, fatalErrorCount: 0 });
    expect(dirty.score).toBeLessThan(clean.score);
  });
  it('fatal error memotong sampai 50 poin', () => {
    const r = computeSopScore({ totalAssignedTasks: 100, tasksOnTime: 100, errorCount: 0, fatalErrorCount: 5 });
    expect(r.fatalPenalty).toBe(50);
    expect(r.score).toBe(50);
  });
  it('skor terkurung 0-100', () => {
    const r = computeSopScore({ totalAssignedTasks: 10, tasksOnTime: 0, errorCount: 10, fatalErrorCount: 10 });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
  it('null-safe: nol tugas tidak NaN', () => {
    const r = computeSopScore({ totalAssignedTasks: 0, tasksOnTime: 0, errorCount: 0, fatalErrorCount: 0 });
    expect(r.score).toBe(0);
  });
});
