/**
 * Assessment Service — mesin tes kandidat (WS-6).
 *
 * Menangani:
 *  - Membuat/me-reset attempt kandidat atas sebuah template (`startAttempt`).
 *  - Menyimpan jawaban per-item & menghitung skor:
 *      • PSIKOMETRI (Likert, WS-3): IRT EAP θ → 0..100 bila item punya
 *        parameter (`irt_a`/`irt_b`); fallback CTT bila tidak ada.
 *      • TEKNIS (MCQ): rasio benar → 0..100 (CTT).
 *      • INTERVIEW (Open): skor diisi HR (`setInterviewScore`).
 *  - Menghitung agregat berbobot 30/40/30 → `candidate_assessment_scores`.
 *
 * Deterministik, driver-agnostic, best-effort (tidak crash).
 */
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { scoreIrt, type IrtItem } from '@/lib/engines/irt-engine';

export type AssessmentType = 'PSYCHOMETRIC' | 'TECHNICAL' | 'INTERVIEW';
export type AssessmentStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'SCORED';

export interface AssessmentOption {
  key: string;
  label: string;
  score?: number;
}

export interface QuestionRow {
  id: string;
  order_index: number;
  type: 'MCQ' | 'LIKERT' | 'CODING' | 'OPEN';
  prompt: string;
  options: AssessmentOption[] | null;
  correct_key: string | null;
  scale: string | null;
  reverse_scored: boolean;
  irt_a?: number | null;
  irt_b?: number | null;
  irt_c?: number | null;
}

export interface TemplateRow {
  id: string;
  code: string;
  title: string;
  type: AssessmentType;
  weight: number;
  description: string | null;
}

/** Ambil template default per tipe (aktif), prioritas yang cocok posisi, lalu generik. */
export async function getTemplateForType(
  db: Db,
  type: AssessmentType,
  positionId?: string | null,
): Promise<TemplateRow | null> {
  const res = (await db.execute(sql`
    SELECT id, code, title, type, weight::float8 AS weight, description
      FROM assessment_templates
     WHERE type = ${type}::assessment_type_enum AND is_active = TRUE
     ORDER BY (position_id = ${positionId ?? null}::uuid) DESC NULLS LAST, created_at ASC
     LIMIT 1
  `)) as unknown as { rows: TemplateRow[] };
  return res.rows?.[0] ?? null;
}

/** Daftar template aktif (untuk katalog asesmen). */
export async function listTemplates(db: Db): Promise<TemplateRow[]> {
  const res = (await db.execute(sql`
    SELECT id, code, title, type, weight::float8 AS weight, description
      FROM assessment_templates WHERE is_active = TRUE ORDER BY type, code
  `)) as unknown as { rows: TemplateRow[] };
  return res.rows ?? [];
}

/**
 * Soal-soal sebuah template (tanpa membocorkan kunci jawaban ke kandidat).
 *
 * Secara default hanya soal AKTIF (`is_active = TRUE`) yang dikembalikan, sehingga
 * soal DRAFT hasil generasi AI (WS-4) tidak pernah terlihat kandidat sebelum
 * disetujui HR. Panel review HR memanggil dengan `{ includeInactive: true }`.
 */
export async function getQuestions(
  db: Db,
  templateId: string,
  opts: { includeAnswers?: boolean; includeInactive?: boolean } = {},
): Promise<QuestionRow[]> {
  const activeFilter = opts.includeInactive ? sql`` : sql` AND is_active = TRUE`;
  const res = (await db.execute(sql`
    SELECT id, order_index, type, prompt, options, correct_key, scale, reverse_scored,
           irt_a::float8 AS irt_a, irt_b::float8 AS irt_b, irt_c::float8 AS irt_c
      FROM assessment_questions WHERE template_id = ${templateId}::uuid${activeFilter} ORDER BY order_index
  `)) as unknown as { rows: QuestionRow[] };
  const rows = res.rows ?? [];
  if (!opts.includeAnswers) {
    return rows.map((r) => ({ ...r, correct_key: null }));
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Skoring CTT
// ---------------------------------------------------------------------------

export interface ResponseInput {
  questionId: string;
  answerKey?: string | null;   // MCQ / LIKERT
  answerText?: string | null;  // OPEN
}

/**
 * Hitung skor CTT untuk sekumpulan jawaban (0..100).
 * - LIKERT: normalisasi rata-rata (min..max dari opsi) → 0..100; reverse bila perlu.
 * - MCQ: rasio benar → 0..100.
 * - OPEN/CODING pada submit kandidat: tidak dinilai otomatis (0 bobot sampai dinilai HR).
 */
export function scoreCtt(
  questions: QuestionRow[],
  responses: ResponseInput[],
): { score: number; raw: number; correct: number; total: number } {
  const qMap = new Map(questions.map((q) => [q.id, q]));
  let sumNorm = 0;
  let counted = 0;
  let correct = 0;
  let total = 0;

  for (const r of responses) {
    const q = qMap.get(r.questionId);
    if (!q) continue;

    if (q.type === 'MCQ') {
      total += 1;
      if (q.correct_key && r.answerKey && r.answerKey === q.correct_key) {
        correct += 1;
        sumNorm += 1;
      }
      counted += 1;
    } else if (q.type === 'LIKERT') {
      const opts = q.options ?? [];
      if (!opts.length) continue;
      const chosen = opts.find((o) => o.key === r.answerKey);
      if (!chosen) continue;
      const scores = opts.map((o) => o.score ?? 0);
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      let s = chosen.score ?? 0;
      if (q.reverse_scored) s = min + max - s; // balik pada rentang opsi
      const norm = max > min ? (s - min) / (max - min) : 0;
      sumNorm += norm;
      counted += 1;
    }
  }

  const raw = counted > 0 ? sumNorm / counted : 0;
  const score = Math.round(Math.max(0, Math.min(1, raw)) * 100 * 100) / 100;
  return { score, raw: Math.round(raw * 1000) / 1000, correct, total };
}

/**
 * Binarisasi satu jawaban Likert → 0/1 (aplikasikan `reverse_scored` dulu,
 * lalu ≥ titik netral → 1). Netral = titik tengah rentang skor opsi
 * (mis. 3 untuk skala 1..5). Kembalikan null bila jawaban tak valid.
 */
function binarizeLikertAnswer(q: QuestionRow, answerKey: string | null | undefined): 0 | 1 | null {
  const opts = q.options ?? [];
  if (!opts.length || answerKey == null) return null;
  const chosen = opts.find((o) => o.key === answerKey);
  if (!chosen) return null;
  const scores = opts.map((o) => o.score ?? 0);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  let s = chosen.score ?? 0;
  if (q.reverse_scored) s = min + max - s;
  const neutral = (min + max) / 2;
  return s >= neutral ? 1 : 0;
}

/**
 * Skoring IRT untuk komponen PSIKOMETRI (WS-3).
 * Mengembalikan null bila tak ada item berparameter (fallback ke CTT).
 */
export function scorePsychometricIrt(
  questions: QuestionRow[],
  responses: ResponseInput[],
): { score: number; theta: number; correct: number; total: number } | null {
  const rMap = new Map(responses.map((r) => [r.questionId, r.answerKey]));
  const binaries: Array<0 | 1> = [];
  const items: IrtItem[] = [];
  for (const q of questions) {
    if (q.type !== 'LIKERT') continue;
    if (q.irt_a == null || q.irt_b == null) continue;
    const a = Number(q.irt_a);
    const b = Number(q.irt_b);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const bin = binarizeLikertAnswer(q, rMap.get(q.id));
    if (bin == null) continue;
    binaries.push(bin);
    items.push({ a, b, c: q.irt_c == null ? 0 : Number(q.irt_c) });
  }
  if (items.length === 0) return null;
  const { theta, score0to100 } = scoreIrt(binaries, items);
  const correct = binaries.filter((v) => v === 1).length;
  return { score: score0to100, theta: Math.round(theta * 1000) / 1000, correct, total: binaries.length };
}

// ---------------------------------------------------------------------------
// Attempt lifecycle
// ---------------------------------------------------------------------------

export interface StartAttemptInput {
  applicationId: string;
  candidateId: string;
  templateId: string;
}

export interface AttemptView {
  attemptId: string;
  status: AssessmentStatus;
  template: TemplateRow;
  questions: QuestionRow[];
  score: number | null;
}

/**
 * Mulai (atau lanjutkan) attempt. Bila sudah SUBMITTED/SCORED → kembalikan tanpa
 * mengubah. Bila belum ada → buat attempt baru berstatus IN_PROGRESS.
 */
export async function startAttempt(db: Db, input: StartAttemptInput): Promise<AttemptView> {
  // Gerbang: tes hanya terbuka setelah HR mengubah status lamaran ≥ SCREENING.
  const appRow = (await db.execute(sql`
    SELECT status::text AS status FROM job_applications WHERE id = ${input.applicationId}::uuid
  `)) as unknown as { rows: Array<{ status: string }> };
  const appStatus = appRow.rows?.[0]?.status ?? null;
  const OPEN_STATUSES = ['SCREENING', 'INTERVIEW', 'OFFERED', 'HIRED'];
  if (!appStatus || !OPEN_STATUSES.includes(appStatus)) {
    const { ForbiddenError } = await import('@/lib/auth/errors');
    throw new ForbiddenError('Tes belum dibuka. Menunggu seleksi HR.');
  }

  const template = (await db.execute(sql`
    SELECT id, code, title, type, weight::float8 AS weight, description
      FROM assessment_templates WHERE id = ${input.templateId}::uuid
  `)) as unknown as { rows: TemplateRow[] };
  const tpl = template.rows?.[0];
  if (!tpl) throw new Error('Template asesmen tidak ditemukan.');

  await db.execute(sql`
    INSERT INTO assessment_attempts (application_id, candidate_id, template_id, status, started_at)
    VALUES (${input.applicationId}::uuid, ${input.candidateId}::uuid, ${input.templateId}::uuid,
            'IN_PROGRESS'::assessment_status_enum, CURRENT_TIMESTAMP)
    ON CONFLICT (application_id, template_id) DO NOTHING
  `);

  const cur = (await db.execute(sql`
    SELECT id, status, score::float8 AS score FROM assessment_attempts
     WHERE application_id = ${input.applicationId}::uuid AND template_id = ${input.templateId}::uuid
  `)) as unknown as { rows: Array<{ id: string; status: AssessmentStatus; score: number | null }> };
  const attempt = cur.rows[0];

  const questions = await getQuestions(db, tpl.id);
  return {
    attemptId: attempt.id,
    status: attempt.status,
    template: tpl,
    questions,
    score: attempt.score,
  };
}

export interface SubmitAttemptInput {
  applicationId: string;
  templateId: string;
  responses: ResponseInput[];
}

export interface SubmitResult {
  score: number;
  correct: number;
  total: number;
}

/**
 * Simpan jawaban & hitung skor. Idempoten: respons di-*upsert* per (attempt, question).
 * Attempt otomatis menjadi SCORED untuk tipe non-INTERVIEW.
 */
export async function submitAttempt(db: Db, input: SubmitAttemptInput): Promise<SubmitResult> {
  const attemptRes = (await db.execute(sql`
    SELECT id, status FROM assessment_attempts
     WHERE application_id = ${input.applicationId}::uuid AND template_id = ${input.templateId}::uuid
  `)) as unknown as { rows: Array<{ id: string; status: AssessmentStatus }> };
  const attempt = attemptRes.rows?.[0];
  if (!attempt) throw new Error('Attempt asesmen tidak ditemukan. Mulai tes terlebih dahulu.');

  // Soal + kunci (internal, untuk penilaian).
  const questions = await getQuestions(db, input.templateId, { includeAnswers: true });

  // Simpan jawaban per item.
  for (const r of input.responses) {
    await db.execute(sql`
      INSERT INTO assessment_responses (attempt_id, question_id, answer_key, answer_text)
      VALUES (${attempt.id}::uuid, ${r.questionId}::uuid, ${r.answerKey ?? null}, ${r.answerText ?? null})
      ON CONFLICT (attempt_id, question_id)
      DO UPDATE SET answer_key = EXCLUDED.answer_key, answer_text = EXCLUDED.answer_text
    `);
  }

  const ctt = scoreCtt(questions, input.responses);
  const isInterview = questions.every((q) => q.type === 'OPEN');
  const isPsychometric = !isInterview && questions.some((q) => q.type === 'LIKERT');

  // WS-3: psikometri memakai IRT (θ → 0..100) bila item berparameter; fallback CTT.
  let result = { score: ctt.score, correct: ctt.correct, total: ctt.total, raw: ctt.raw };
  if (isPsychometric) {
    const irt = scorePsychometricIrt(questions, input.responses);
    if (irt) result = { score: irt.score, correct: irt.correct, total: irt.total, raw: irt.theta };
  }

  await db.execute(sql`
    UPDATE assessment_attempts
       SET status = ${isInterview ? 'SUBMITTED' : 'SCORED'}::assessment_status_enum,
           score = ${result.score}, raw_score = ${result.raw},
           submitted_at = CURRENT_TIMESTAMP
     WHERE id = ${attempt.id}::uuid
  `);

  // Perbarui agregat 30/40/30 (non-interview) + timeline.
  if (!isInterview) {
    await recomputeWeightedForApplication(db, input.applicationId);
    await syncAssessmentTimeline(db, input.applicationId, input.templateId);
  }

  return { score: result.score, correct: result.correct, total: result.total };
}

/** Skor wawancara diisi HR (0..100). Menyimpan pada attempt INTERVIEW. */
export async function setInterviewScore(
  db: Db,
  applicationId: string,
  score: number,
  note?: string,
): Promise<{ ok: boolean }> {
  const tpl = await getTemplateForType(db, 'INTERVIEW');
  if (!tpl) throw new Error('Template wawancara tidak ditemukan.');
  const clamped = Math.max(0, Math.min(100, score));

  // Pastikan attempt ada (buat bila belum) lalu set skor final.
  await db.execute(sql`
    INSERT INTO assessment_attempts (application_id, template_id, candidate_id, status, score, submitted_at)
    SELECT ${applicationId}::uuid, ${tpl.id}::uuid, ja.candidate_id,
           'SCORED'::assessment_status_enum, ${clamped}, CURRENT_TIMESTAMP
      FROM job_applications ja WHERE ja.id = ${applicationId}::uuid
    ON CONFLICT (application_id, template_id)
    DO UPDATE SET score = ${clamped}, status = 'SCORED'::assessment_status_enum, submitted_at = CURRENT_TIMESTAMP
  `);
  void note;
  await recomputeWeightedForApplication(db, applicationId);
  await syncAssessmentTimeline(db, applicationId, tpl.id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Agregasi berbobot 30/40/30
// ---------------------------------------------------------------------------

/** Skor terbaru per tipe dari attempts SCORED untuk sebuah lamaran. */
async function latestScores(db: Db, applicationId: string): Promise<Record<AssessmentType, number | null>> {
  const res = (await db.execute(sql`
    SELECT t.type::text AS type, a.score::float8 AS score
      FROM assessment_attempts a
      JOIN assessment_templates t ON t.id = a.template_id
     WHERE a.application_id = ${applicationId}::uuid AND a.status = 'SCORED' AND a.score IS NOT NULL
     ORDER BY a.submitted_at DESC NULLS LAST, a.created_at DESC
  `)) as unknown as { rows: Array<{ type: AssessmentType; score: number }> };
  const out: Record<AssessmentType, number | null> = { PSYCHOMETRIC: null, TECHNICAL: null, INTERVIEW: null };
  for (const r of res.rows ?? []) {
    if (out[r.type] == null) out[r.type] = Number(r.score);
  }
  return out;
}

/**
 * Hitung ulang agregat berbobot & simpan ke `candidate_assessment_scores`.
 * Bobot default 30/40/30; komponen yang belum ada diabaikan (dinormalisasi ulang
 * terhadap total bobot yang tersedia agar skor tidak "tenggelam").
 */
export async function recomputeWeightedForApplication(
  db: Db,
  applicationId: string,
): Promise<{ psychometric: number | null; technical: number | null; interview: number | null; weighted: number | null }> {
  const scores = await latestScores(db, applicationId);
  const W = { PSYCHOMETRIC: 30, TECHNICAL: 40, INTERVIEW: 30 };
  let wsum = 0;
  let acc = 0;
  (Object.keys(W) as AssessmentType[]).forEach((t) => {
    if (scores[t] != null) {
      acc += scores[t]! * W[t];
      wsum += W[t];
    }
  });
  const weighted = wsum > 0 ? Math.round((acc / wsum) * 100) / 100 : null;

  await db.execute(sql`
    INSERT INTO candidate_assessment_scores
      (application_id, psychometric_score, technical_score, interview_score, final_weighted_score, computed_at)
    VALUES (${applicationId}::uuid, ${scores.PSYCHOMETRIC}, ${scores.TECHNICAL}, ${scores.INTERVIEW},
            ${weighted}, CURRENT_TIMESTAMP)
    ON CONFLICT (application_id)
    DO UPDATE SET psychometric_score = EXCLUDED.psychometric_score,
                  technical_score = EXCLUDED.technical_score,
                  interview_score = EXCLUDED.interview_score,
                  final_weighted_score = EXCLUDED.final_weighted_score,
                  computed_at = CURRENT_TIMESTAMP
  `);

  return { psychometric: scores.PSYCHOMETRIC, technical: scores.TECHNICAL, interview: scores.INTERVIEW, weighted };
}

/** Ambil agregat skor sebuah lamaran (untuk review HR). */
export async function getAssessmentScores(db: Db, applicationId: string) {
  const res = (await db.execute(sql`
    SELECT psychometric_score::float8 AS "psychometric", technical_score::float8 AS "technical",
           interview_score::float8 AS "interview", final_weighted_score::float8 AS "weighted",
           computed_at AS "computedAt"
      FROM candidate_assessment_scores WHERE application_id = ${applicationId}::uuid
  `)) as unknown as { rows: any[] };
  return res.rows?.[0] ?? null;
}

/** Timeline: tandai tahap sesuai tipe asesmen yang selesai. */
async function syncAssessmentTimeline(db: Db, applicationId: string, templateId: string): Promise<void> {
  try {
    const t = (await db.execute(sql`
      SELECT type::text AS type FROM assessment_templates WHERE id = ${templateId}::uuid
    `)) as unknown as { rows: Array<{ type: AssessmentType }> };
    const type = t.rows?.[0]?.type;
    const stage = type === 'PSYCHOMETRIC' ? 'PSYCHOMETRIC' : type === 'TECHNICAL' ? 'TECHNICAL' : 'INTERVIEW';
    const { upsertStage } = await import('@/lib/services/timelineService');
    await upsertStage(db, { applicationId, stage: stage as any, status: 'PASSED' });
  } catch {
    /* timeline opsional */
  }
}

/** Status ringkas seluruh asesmen untuk sebuah lamaran (untuk UI kandidat/HR). */
export async function listAttemptsForApplication(db: Db, applicationId: string) {
  const res = (await db.execute(sql`
    SELECT a.id AS "attemptId", a.status, a.score::float8 AS score, a.submitted_at AS "submittedAt",
           t.code, t.title, t.type::text AS type, t.weight::float8 AS weight
      FROM assessment_attempts a
      JOIN assessment_templates t ON t.id = a.template_id
     WHERE a.application_id = ${applicationId}::uuid
     ORDER BY t.type
  `)) as unknown as { rows: any[] };
  return res.rows ?? [];
}
