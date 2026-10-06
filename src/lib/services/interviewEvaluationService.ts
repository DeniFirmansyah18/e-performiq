/**
 * Interview Evaluation Service — rubrik wawancara terstruktur (7 kriteria).
 *
 * HR menilai 7 kriteria (skala 1..5). Rata-rata dikonversi ke 0..100 dan
 * diumpankan ke `setInterviewScore` sehingga masuk ke agregat 30/40/30 yang
 * dipakai kartu "Review" (endpoint /api/v1/recruitment/candidates/:id/review).
 *
 * Prinsip: deterministik, idempoten (upsert per lamaran), tidak crash.
 */
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export const RUBRIC_CRITERIA = [
  { key: 'technical_skill', label: 'Kompetensi Teknis / Keahlian' },
  { key: 'problem_solving', label: 'Pemecahan Masalah / Analytical Thinking' },
  { key: 'communication', label: 'Komunikasi & Kejelasan' },
  { key: 'collaboration', label: 'Kolaborasi / Team Fit' },
  { key: 'motivation', label: 'Motivasi & Culture Fit' },
  { key: 'leadership', label: 'Kepemimpinan / Potensi' },
  { key: 'professionalism', label: 'Sikap & Profesionalisme' },
] as const;

export type RubricKey = (typeof RUBRIC_CRITERIA)[number]['key'];

export interface InterviewEvaluationInput {
  applicationId: string;
  evaluatorUserId?: string | null;
  interviewId?: string | null;
  /** Skor per kriteria, skala 1..5 (boleh sebagian; null/undefined = tidak dinilai). */
  scores: Partial<Record<RubricKey, number | null>>;
  strengths?: string | null;
  concerns?: string | null;
  notes?: string | null;
}

export interface InterviewEvaluation {
  applicationId: string;
  scores: Record<RubricKey, number | null>;
  compositeScore: number | null;
  strengths: string | null;
  concerns: string | null;
  notes: string | null;
  recommendation: 'STRONG_HIRE' | 'HIRE' | 'CONSIDER' | 'NO_HIRE' | null;
  updatedAt: string | null;
}

/** Klem nilai ke rentang [min,max]; non-finite → null. */
function clamp(v: number | null | undefined, min: number, max: number): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return Math.max(min, Math.min(max, Math.round(v)));
}

/**
 * Rata-rata kriteria (1..5) → skor 0..100. Skala 1..5 dipetakan linier:
 * 1 → 0, 5 → 100 (yaitu (avg-1)/4*100), dibulatkan 2 desimal.
 * Tidak ada kriteria dinilai → null.
 */
export function rubricToComposite(scores: Partial<Record<RubricKey, number | null>>): number | null {
  const vals = RUBRIC_CRITERIA
    .map((c) => clamp(scores[c.key], 1, 5))
    .filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.round(((avg - 1) / 4) * 100 * 100) / 100;
}

/** Rekomendasi deterministik dari skor komposit (0..100). */
export function rubricRecommendation(composite: number | null): InterviewEvaluation['recommendation'] {
  if (composite == null) return null;
  if (composite >= 85) return 'STRONG_HIRE';
  if (composite >= 70) return 'HIRE';
  if (composite >= 55) return 'CONSIDER';
  return 'NO_HIRE';
}

/** Simpan (upsert) evaluasi wawancara + sinkronkan skor wawancara ke agregat. */
export async function saveInterviewEvaluation(
  db: Db,
  input: InterviewEvaluationInput,
): Promise<InterviewEvaluation> {
  const composite = rubricToComposite(input.scores);
  const s = (k: RubricKey) => clamp(input.scores[k], 1, 5);

  await db.execute(sql`
    INSERT INTO interview_evaluations
      (application_id, interview_id, evaluator_user_id,
       technical_skill, problem_solving, communication, collaboration,
       motivation, leadership, professionalism,
       composite_score, strengths, concerns, notes, recommendation)
    VALUES (${input.applicationId}::uuid, ${input.interviewId ?? null}::uuid, ${input.evaluatorUserId ?? null}::uuid,
            ${s('technical_skill')}, ${s('problem_solving')}, ${s('communication')}, ${s('collaboration')},
            ${s('motivation')}, ${s('leadership')}, ${s('professionalism')},
            ${composite}, ${input.strengths ?? null}, ${input.concerns ?? null}, ${input.notes ?? null},
            ${rubricRecommendation(composite)})
    ON CONFLICT (application_id)
    DO UPDATE SET interview_id = COALESCE(EXCLUDED.interview_id, interview_evaluations.interview_id),
                  evaluator_user_id = COALESCE(EXCLUDED.evaluator_user_id, interview_evaluations.evaluator_user_id),
                  technical_skill = EXCLUDED.technical_skill,
                  problem_solving = EXCLUDED.problem_solving,
                  communication = EXCLUDED.communication,
                  collaboration = EXCLUDED.collaboration,
                  motivation = EXCLUDED.motivation,
                  leadership = EXCLUDED.leadership,
                  professionalism = EXCLUDED.professionalism,
                  composite_score = EXCLUDED.composite_score,
                  strengths = COALESCE(EXCLUDED.strengths, interview_evaluations.strengths),
                  concerns = COALESCE(EXCLUDED.concerns, interview_evaluations.concerns),
                  notes = COALESCE(EXCLUDED.notes, interview_evaluations.notes),
                  recommendation = EXCLUDED.recommendation,
                  updated_at = CURRENT_TIMESTAMP
  `);

  return {
    applicationId: input.applicationId,
    scores: {
      technical_skill: s('technical_skill'),
      problem_solving: s('problem_solving'),
      communication: s('communication'),
      collaboration: s('collaboration'),
      motivation: s('motivation'),
      leadership: s('leadership'),
      professionalism: s('professionalism'),
    },
    compositeScore: composite,
    strengths: input.strengths ?? null,
    concerns: input.concerns ?? null,
    notes: input.notes ?? null,
    recommendation: rubricRecommendation(composite),
    updatedAt: new Date().toISOString(),
  };
}

/** Ambil evaluasi wawancara (bila ada). */
export async function getInterviewEvaluation(
  db: Db,
  applicationId: string,
): Promise<InterviewEvaluation | null> {
  const res = (await db.execute(sql`
    SELECT technical_skill, problem_solving, communication, collaboration,
           motivation, leadership, professionalism,
           composite_score::float8 AS "compositeScore",
           strengths, concerns, notes, recommendation::text AS recommendation,
           updated_at AS "updatedAt"
      FROM interview_evaluations WHERE application_id = ${applicationId}::uuid
  `)) as unknown as { rows: Array<Record<string, unknown>> };
  const r = res.rows?.[0];
  if (!r) return null;
  const num = (v: unknown) => (v == null ? null : Number(v));
  return {
    applicationId,
    scores: {
      technical_skill: num(r.technical_skill),
      problem_solving: num(r.problem_solving),
      communication: num(r.communication),
      collaboration: num(r.collaboration),
      motivation: num(r.motivation),
      leadership: num(r.leadership),
      professionalism: num(r.professionalism),
    },
    compositeScore: num(r.compositeScore),
    strengths: (r.strengths as string) ?? null,
    concerns: (r.concerns as string) ?? null,
    notes: (r.notes as string) ?? null,
    recommendation: (r.recommendation as InterviewEvaluation['recommendation']) ?? null,
    updatedAt: r.updatedAt ? new Date(r.updatedAt as string).toISOString() : null,
  };
}
