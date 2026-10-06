/**
 * Candidate Review Service (WS-7) — agregasi penilaian kandidat + advisory AI + keputusan HR.
 *
 * Mengumpulkan:
 *  - Skor ATS (`resume_parses.ats_score`, matched/missing skills)
 *  - Skor asesmen berbobot 30/40/30 (`candidate_assessment_scores`)
 *  - Profil singkat (pendidikan, pengalaman, skill)
 *
 * Menyusun "kartu review" untuk HR dan, atas permintaan, ringkasan advisory
 * dari `aiService`. AI bersifat ASISTIF: kegagalan/ketiadaan provider tidak
 * memblokir keputusan manusia (fallback deterministik selalu tersedia).
 *
 * Prinsip: deterministik, best-effort, tidak crash.
 */
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import type { InterviewEvaluation } from '@/lib/services/interviewEvaluationService';

export interface CandidateReview {
  applicationId: string;
  applicationNo: string;
  applicationStatus: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  postingTitle: string;
  department: string;
  position: string;

  atsScore: number | null;
  matchedSkills: string[];
  missingSkills: string[];
  requiredSkills: string[];

  psychometricScore: number | null;
  technicalScore: number | null;
  interviewScore: number | null;
  finalWeightedScore: number | null;

  /** Skor gabungan usulan: 40% ATS + 60% weighted asesmen (0..100). */
  overallScore: number | null;
  recommendation: 'STRONG_HIRE' | 'HIRE' | 'CONSIDER' | 'NO_HIRE' | 'INSUFFICIENT_DATA';

  topSkills: string[];
  education: string | null;
  experienceYears: number | null;

  decision: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'TALENT_POOL';
  aiSummary: string | null;
  decisionNotes: string | null;

  /** Rubrik wawancara terstruktur (bila HR sudah menilai). */
  interviewEvaluation: InterviewEvaluation | null;
}

/** Ubah JSONB skill (array/objek) menjadi daftar string. */
function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? x : (x as any)?.name ?? '')).filter(Boolean);
  if (typeof v === 'string') { try { return toStringArray(JSON.parse(v)); } catch { return []; } }
  return [];
}

/** Skor gabungan: 40% ATS + 60% weighted asesmen (bila keduanya ada). */
export function computeOverallScore(ats: number | null, weighted: number | null): number | null {
  if (ats == null && weighted == null) return null;
  if (ats == null) return weighted;
  if (weighted == null) return ats;
  return Math.round((ats * 0.4 + weighted * 0.6) * 100) / 100;
}

export interface RecommendInput {
  ats: number | null;
  weighted: number | null;
  psychometric: number | null;
  technical: number | null;
  interview: number | null;
  hasAts: boolean;
  hasAssessment: boolean;
}

/**
 * Rekomendasi deterministik (ambang batas). Bila data tak cukup → INSUFFICIENT_DATA.
 * Selalu tersedia tanpa AI (fallback aman).
 */
export function recommend(i: RecommendInput): CandidateReview['recommendation'] {
  if (!i.hasAts && !i.hasAssessment) return 'INSUFFICIENT_DATA';
  const overall = computeOverallScore(i.ats, i.weighted);
  if (overall == null) return 'INSUFFICIENT_DATA';
  if (overall >= 85) return 'STRONG_HIRE';
  if (overall >= 70) return 'HIRE';
  if (overall >= 55) return 'CONSIDER';
  return 'NO_HIRE';
}

const RECO_LABEL: Record<CandidateReview['recommendation'], string> = {
  STRONG_HIRE: 'Sangat Direkomendasikan',
  HIRE: 'Direkomendasikan',
  CONSIDER: 'Perlu Pertimbangan',
  NO_HIRE: 'Tidak Direkomendasikan',
  INSUFFICIENT_DATA: 'Data Belum Cukup',
};

export function recommendationLabel(r: CandidateReview['recommendation']): string {
  return RECO_LABEL[r];
}

/** Ambil agregat review lengkap untuk sebuah lamaran. */
export async function getCandidateReview(db: Db, applicationId: string): Promise<CandidateReview | null> {
  const app = (await db.execute(sql`
    SELECT ja.id AS "applicationId", ja.application_no AS "applicationNo", ja.status AS "applicationStatus",
           ja.candidate_id AS "candidateId", c.full_name AS "candidateName", c.email AS "candidateEmail",
           c.education, jp.posting_title AS "postingTitle", jp.required_skills AS "requiredSkills",
           jp.description AS "postingDescription",
           d.department_name AS "department", p.position_title AS "position"
      FROM job_applications ja
      JOIN candidates c ON c.id = ja.candidate_id
      JOIN job_postings jp ON jp.id = ja.job_posting_id
      JOIN departments d ON d.id = jp.department_id
      JOIN job_positions p ON p.id = jp.position_id
     WHERE ja.id = ${applicationId}::uuid
  `)) as unknown as { rows: any[] };
  const row = app.rows?.[0];
  if (!row) return null;

  const atsRes = (await db.execute(sql`
    SELECT ats_score::float8 AS "atsScore", matched_skills AS "matched", missing_skills AS "missing",
           raw_text AS "rawText", parsed_json AS "parsedJson"
      FROM resume_parses WHERE application_id = ${applicationId}::uuid
     ORDER BY created_at DESC LIMIT 1
  `)) as unknown as { rows: any[] };
  const ats = atsRes.rows?.[0] ?? {};

  // Hitung ulang skor ATS dari data tersimpan agar nilai yang ditampilkan selalu
  // memakai algoritma terkini — walau kandidat melamar sebelum algoritma berubah.
  // Fallback ke skor tersimpan bila teks tertentu tak cukup untuk menghitung.
  let atsScoreComputed: number | null = null;
  let matchedComputed: string[] | null = null;
  let missingComputed: string[] | null = null;
  const requiredSkillsForJob = toStringArray(row.requiredSkills);
  if (ats.rawText && String(ats.rawText).trim().length > 0 && requiredSkillsForJob.length > 0) {
    try {
      const { computeAtsScore } = await import('@/lib/services/atsService');
      const { parseResumeHeuristic, extractSkills, normalizeResumeText } = await import('@/lib/services/resumeParser');
      const text = normalizeResumeText(String(ats.rawText));
      const parsed = parseResumeHeuristic(text);
      parsed.skills = Array.from(new Set([...(parsed.skills ?? []), ...extractSkills(text)]));
      const jobText = [row.postingTitle ?? '', row.postingDescription ?? '', requiredSkillsForJob.join(' ')].join(' ').trim();
      const recomputed = computeAtsScore(parsed, requiredSkillsForJob, jobText, text);
      atsScoreComputed = recomputed.score;
      matchedComputed = recomputed.matched;
      missingComputed = recomputed.missing;
    } catch {
      atsScoreComputed = null;
    }
  }
  const atsScore = atsScoreComputed != null
    ? atsScoreComputed
    : (ats.atsScore != null ? Number(ats.atsScore) : null);

  const scRes = (await db.execute(sql`
    SELECT psychometric_score::float8 AS "psychometric", technical_score::float8 AS "technical",
           interview_score::float8 AS "interview", final_weighted_score::float8 AS "weighted"
      FROM candidate_assessment_scores WHERE application_id = ${applicationId}::uuid
  `)) as unknown as { rows: any[] };
  const sc = scRes.rows?.[0] ?? {};

  const skillRes = (await db.execute(sql`
    SELECT skill_name FROM candidate_skills WHERE candidate_id = ${row.candidateId}::uuid LIMIT 12
  `)) as unknown as { rows: Array<{ skill_name: string }> };
  const expRes = (await db.execute(sql`
    SELECT MIN(start_date) AS first_start FROM candidate_experiences WHERE candidate_id = ${row.candidateId}::uuid
  `)) as unknown as { rows: Array<{ first_start: string | null }> };
  let experienceYears: number | null = null;
  if (expRes.rows?.[0]?.first_start) {
    const yrs = (Date.now() - new Date(expRes.rows[0].first_start).getTime()) / (365.25 * 24 * 3600 * 1000);
    experienceYears = Math.max(0, Math.round(yrs * 10) / 10);
  }

  const decRes = (await db.execute(sql`
    SELECT decision::text AS decision, ai_summary AS "aiSummary", notes AS "decisionNotes"
      FROM candidate_decisions WHERE application_id = ${applicationId}::uuid
  `)) as unknown as { rows: any[] };
  const dec = decRes.rows?.[0] ?? {};

  const { getInterviewEvaluation } = await import('@/lib/services/interviewEvaluationService');
  const interviewEvaluation = await getInterviewEvaluation(db, applicationId);

  const weighted = sc.weighted != null ? Number(sc.weighted) : null;
  const overallScore = computeOverallScore(atsScore, weighted);
  const recommendation = recommend({
    ats: atsScore, weighted,
    psychometric: sc.psychometric != null ? Number(sc.psychometric) : null,
    technical: sc.technical != null ? Number(sc.technical) : null,
    interview: sc.interview != null ? Number(sc.interview) : null,
    hasAts: atsScore != null, hasAssessment: weighted != null,
  });

  return {
    applicationId: row.applicationId,
    applicationNo: row.applicationNo,
    applicationStatus: row.applicationStatus,
    candidateId: row.candidateId,
    candidateName: row.candidateName,
    candidateEmail: row.candidateEmail,
    postingTitle: row.postingTitle,
    department: row.department,
    position: row.position,
    atsScore,
    matchedSkills: matchedComputed ?? toStringArray(ats.matched),
    missingSkills: missingComputed ?? toStringArray(ats.missing),
    requiredSkills: requiredSkillsForJob,
    psychometricScore: sc.psychometric != null ? Number(sc.psychometric) : null,
    technicalScore: sc.technical != null ? Number(sc.technical) : null,
    interviewScore: sc.interview != null ? Number(sc.interview) : null,
    finalWeightedScore: weighted,
    overallScore,
    recommendation,
    topSkills: (skillRes.rows ?? []).map((r) => r.skill_name),
    education: row.education ?? null,
    experienceYears,
    decision: (dec.decision as CandidateReview['decision']) ?? 'PENDING',
    aiSummary: dec.aiSummary ?? null,
    decisionNotes: dec.decisionNotes ?? null,
    interviewEvaluation,
  };
}

// ---------------------------------------------------------------------------
// AI advisory (asistif, dengan fallback)
// ---------------------------------------------------------------------------

/** Ringkasan deterministik (fallback bila AI tak tersedia). */
export function fallbackSummary(review: CandidateReview): string {
  const parts: string[] = [];
  parts.push(`Kandidat ${review.candidateName} untuk posisi ${review.postingTitle} (${review.department}).`);
  if (review.atsScore != null) parts.push(`Skor kesesuaian berkas (ATS): ${review.atsScore.toFixed(0)}/100.`);
  if (review.finalWeightedScore != null) parts.push(`Skor asesmen gabungan (30/40/30): ${review.finalWeightedScore.toFixed(0)}/100.`);
  if (review.technicalScore != null) parts.push(`Teknis: ${review.technicalScore.toFixed(0)}.`);
  if (review.psychometricScore != null) parts.push(`Psikometri: ${review.psychometricScore.toFixed(0)}.`);
  if (review.interviewScore != null) parts.push(`Wawancara: ${review.interviewScore.toFixed(0)}.`);
  if (review.missingSkills.length) parts.push(`Kualifikasi belum terlihat: ${review.missingSkills.slice(0, 5).join(', ')}.`);
  parts.push(`Rekomendasi sistem: ${recommendationLabel(review.recommendation)}.`);
  return parts.join(' ');
}

function buildPrompt(review: CandidateReview): string {
  const data = {
    posisi: review.postingTitle,
    divisi: review.department,
    kandidat: review.candidateName,
    pendidikan: review.education,
    pengalamanTahun: review.experienceYears,
    skorAts: review.atsScore,
    skorPsikometri: review.psychometricScore,
    skorTeknis: review.technicalScore,
    skorWawancara: review.interviewScore,
    skorGabunganAsesmen: review.finalWeightedScore,
    skillUtama: review.topSkills,
    kualifikasiTerpenuhi: review.matchedSkills,
    kualifikasiBelumTerlihat: review.missingSkills,
    rekomendasiSistem: recommendationLabel(review.recommendation),
  };
  return (
    'Anda menganalisis profil kandidat untuk membantu keputusan HR. Data (JSON):\n' +
    JSON.stringify(data) +
    '\n\nTulis analisis SINGKAT dalam BAHASA INDONESIA dengan struktur TEPAT berikut, tanpa bagian lain:\n' +
    '**Ringkasan:** (2 kalimat)\n' +
    '**Kekuatan:**\n- (poin 1)\n- (poin 2)\n' +
    '**Area Perhatian:**\n- (poin 1)\n' +
    '**Rekomendasi:** (1 kalimat tindakan)\n' +
    'Gunakan hanya data di atas; jangan mengarang angka. Bersikap netral & profesional.'
  );
}

export interface ReviewWithAi {
  review: CandidateReview;
  aiSummary: string;
  aiConfigured: boolean;
}

/**
 * Review lengkap + ringkasan AI. AI gagal/tak tersedia → fallbackSummary().
 */
export async function getCandidateReviewWithAi(db: Db, applicationId: string): Promise<ReviewWithAi | null> {
  const review = await getCandidateReview(db, applicationId);
  if (!review) return null;

  if (review.aiSummary && review.aiSummary.trim().length > 0) {
    return { review, aiSummary: review.aiSummary, aiConfigured: true };
  }

  try {
    const { generateContent, isAiConfigured } = await import('@/lib/services/aiService');
    if (!isAiConfigured()) {
      return { review, aiSummary: fallbackSummary(review), aiConfigured: false };
    }
    const res = await generateContent(buildPrompt(review), { maxOutputTokens: 1400, temperature: 0.25 });
    const text = res?.text && res.text.trim().length > 0 ? res.text.trim() : fallbackSummary(review);
    return { review, aiSummary: text, aiConfigured: res?.configured ?? false };
  } catch {
    return { review, aiSummary: fallbackSummary(review), aiConfigured: false };
  }
}

// ---------------------------------------------------------------------------
// Keputusan HR
// ---------------------------------------------------------------------------

export interface DecisionInput {
  applicationId: string;
  decidedByUserId: string;
  decision: 'ACCEPTED' | 'REJECTED' | 'TALENT_POOL' | 'PENDING';
  notes?: string;
  aiSummary?: string;
}

/**
 * Simpan keputusan HR (upsert pada `candidate_decisions`), sinkronkan status
 * lamaran + timeline. ACCEPTED → status lamaran OFFERED (lolos seleksi);
 * HIRED ditandai terpisah saat onboarding. REJECTED → REJECTED.
 */
export async function recordDecision(db: Db, input: DecisionInput): Promise<CandidateReview['decision']> {
  const review = await getCandidateReview(db, input.applicationId);
  if (!review) throw new Error('Lamaran tidak ditemukan.');

  await db.execute(sql`
    INSERT INTO candidate_decisions
      (application_id, decided_by_user_id, decision, final_score, ai_summary, notes)
    VALUES (${input.applicationId}::uuid, ${input.decidedByUserId}::uuid,
            ${input.decision}::candidate_decision_enum, ${review.overallScore}, ${input.aiSummary ?? null}, ${input.notes ?? null})
    ON CONFLICT (application_id)
    DO UPDATE SET decision = EXCLUDED.decision,
                  decided_by_user_id = EXCLUDED.decided_by_user_id,
                  final_score = EXCLUDED.final_score,
                  ai_summary = COALESCE(EXCLUDED.ai_summary, candidate_decisions.ai_summary),
                  notes = COALESCE(EXCLUDED.notes, candidate_decisions.notes),
                  decided_at = CURRENT_TIMESTAMP
  `);

  const appStatus = input.decision === 'ACCEPTED' ? 'OFFERED'
    : input.decision === 'REJECTED' ? 'REJECTED'
    : null;
  if (appStatus) {
    await db.execute(sql`
      UPDATE job_applications SET status = ${appStatus}::application_status_enum
       WHERE id = ${input.applicationId}::uuid
    `);
  }

  try {
    const { syncApplicationTimeline, upsertStage } = await import('@/lib/services/timelineService');
    await syncApplicationTimeline(db, input.applicationId);
    // Keputusan eksplisit menentukan status tahap DECISION (mengalahkan turunan status).
    const decisionStageStatus = input.decision === 'ACCEPTED' ? 'PASSED'
      : input.decision === 'REJECTED' ? 'FAILED'
      : 'IN_PROGRESS';
    await upsertStage(db, {
      applicationId: input.applicationId,
      stage: 'DECISION',
      status: decisionStageStatus,
      actorUserId: input.decidedByUserId,
    });
  } catch {
    /* timeline opsional */
  }
  return input.decision;
}

/** Simpan ringkasan AI agar tidak dipanggil ulang setiap review dibuka. */
export async function saveAiSummary(db: Db, applicationId: string, summary: string): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO candidate_decisions (application_id, decision, ai_summary)
      VALUES (${applicationId}::uuid, 'PENDING'::candidate_decision_enum, ${summary})
      ON CONFLICT (application_id)
      DO UPDATE SET ai_summary = EXCLUDED.ai_summary
    `);
  } catch {
    /* opsional */
  }
}

/** Daftar kandidat untuk tahap review (punya skor ATS/asesmen), untuk HR. */
export async function listReviewQueue(db: Db, limit = 100) {
  const res = (await db.execute(sql`
    SELECT ja.id AS "applicationId", ja.application_no AS "applicationNo", ja.status AS "applicationStatus",
           c.full_name AS "candidateName", c.email, jp.posting_title AS "postingTitle",
           rp.ats_score::float8 AS "atsScore",
           cas.final_weighted_score::float8 AS "weightedScore",
           cd.decision::text AS "decision"
      FROM job_applications ja
      JOIN candidates c ON c.id = ja.candidate_id
      JOIN job_postings jp ON jp.id = ja.job_posting_id
      LEFT JOIN candidate_assessment_scores cas ON cas.application_id = ja.id
      LEFT JOIN candidate_decisions cd ON cd.application_id = ja.id
      LEFT JOIN LATERAL (
        SELECT ats_score FROM resume_parses WHERE application_id = ja.id ORDER BY created_at DESC LIMIT 1
      ) rp ON TRUE
     ORDER BY ja.applied_at DESC
     LIMIT ${limit}
  `)) as unknown as { rows: any[] };
  return res.rows ?? [];
}
