// Quiz Engine — penilaian kuis lesson (ambang lulus 70).
export interface QuizResult {
  correct: number;
  total: number;
  score: number;
  passed: boolean;
}

export function gradeQuiz(answers: number[], key: { q: number; a: number }[]): QuizResult {
  const total = key?.length ?? 0;
  if (!total) return { correct: 0, total: 0, score: 0, passed: false };
  let correct = 0;
  for (const item of key) {
    if (answers?.[item.q - 1] === item.a) correct++;
  }
  const score = Number(((correct / total) * 100).toFixed(2));
  return { correct, total, score, passed: score >= 70 };
}
