import { describe, it, expect } from 'vitest';
import { gradeQuiz } from '@/lib/engines/quiz-engine';

describe('quiz-engine', () => {
  const key = [{ q: 1, a: 1 }, { q: 2, a: 0 }];
  it('menilai jawaban benar & lulus', () => {
    expect(gradeQuiz([1, 0], key)).toEqual({ correct: 2, total: 2, score: 100, passed: true });
  });
  it('gagal bila skor < 70', () => {
    const r = gradeQuiz([0, 0], key);
    expect(r.score).toBe(50);
    expect(r.passed).toBe(false);
  });
  it('null-safe untuk kuis kosong', () => {
    expect(gradeQuiz([], [])).toEqual({ correct: 0, total: 0, score: 0, passed: false });
  });
});
