/**
 * ATS Service — Applicants Tracking System scoring.
 *
 * Alur:
 *   1. Terima teks CV + daftar skill yang diminta lowongan (`required_skills`).
 *   2. Normalisasi & cocokkan skill (exact + sinonim/alias) → matched/missing.
 *   3. Hitung skor ATS 0–100 dari beberapa komponen berbobot:
 *        • kecocokan skill        (60%)
 *        • kelengkapan kontak     (10%)
 *        • pengalaman kerja       (15%)
 *        • pendidikan             (10%)
 *        • kelengkapan ringkasan  (5%)
 *   4. Simpan hasil ke `resume_parses` (raw_text, parsed_json, ats_score,
 *      matched_skills, missing_skills, parser) dan sinkronkan profil kandidat
 *      (candidate_skills / candidate_educations / candidate_experiences).
 *
 * Deterministik & tidak pernah crash. Semua operasi DB dibungkus try/catch dan
 * dipanggil dengan driver-agnostic `db.execute(sql...)` (lihat plan #7).
 */
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import {
  type ParsedResume,
  extractSkills,
  normalizeResumeText,
  parseResume,
} from '@/lib/services/resumeParser';

// ---------------------------------------------------------------------------
// Sinonim / alias skill → kanonik. Dipakai agar "Js" cocok "JavaScript",
// "Postgres" cocok "PostgreSQL", dsb. Kunci = lowercase, nilai = label kanonik.
// ---------------------------------------------------------------------------
const SKILL_ALIASES: Record<string, string> = {
  js: 'JavaScript', javascript: 'JavaScript', ts: 'TypeScript', typescript: 'TypeScript',
  node: 'Node.js', nodejs: 'Node.js', 'node.js': 'Node.js', reactjs: 'React', react: 'React',
  'nextjs': 'Next.js', 'next.js': 'Next.js', postgres: 'PostgreSQL', postgresql: 'PostgreSQL',
  mysql: 'MySQL', mongo: 'MongoDB', mongodb: 'MongoDB', py: 'Python', python: 'Python',
  golang: 'Go', go: 'Go', k8s: 'Kubernetes', kubernetes: 'Kubernetes', docker: 'Docker',
  aws: 'AWS', gcp: 'GCP', azure: 'Azure', sql: 'SQL', excel: 'Excel', 'ms excel': 'Excel',
  'microsoft excel': 'Excel', hris: 'HRIS', hr: 'Human Resources', payroll: 'Payroll',
  rekrutmen: 'Recruitment', recruitment: 'Recruitment', rekruitmen: 'Recruitment',
  komunikasi: 'Komunikasi', communication: 'Komunikasi', kepemimpinan: 'Kepemimpinan',
  leadership: 'Leadership', 'manajemen proyek': 'Manajemen Proyek', 'project management': 'Manajemen Proyek',
  akuntansi: 'Akuntansi', accounting: 'Akuntansi', pajak: 'Perpajakan', tax: 'Perpajakan',
  'power bi': 'Power BI', 'powerbi': 'Power BI', tableau: 'Tableau', ml: 'Machine Learning',
  'machine learning': 'Machine Learning', ai: 'Machine Learning', 'data analysis': 'Data Analysis',
  'analisis data': 'Data Analysis', qa: 'Quality Assurance', 'quality assurance': 'Quality Assurance',
};

/** Normalisasi label skill ke bentuk kanonik untuk perbandingan. */
export function canonicalSkill(raw: string): string {
  const key = String(raw ?? '').trim().toLowerCase();
  return SKILL_ALIASES[key] ?? raw.trim();
}

/** Kunci pembanding: lowercase + tanpa spasi/tanda baca (untuk fuzzy ringan). */
function compareKey(raw: string): string {
  return canonicalSkill(raw).toLowerCase().replace(/[^a-z0-9&+#]/g, '');
}

export interface AtsSkillResult {
  required: string[];
  matched: string[];
  missing: string[];
  matchRatio: number; // 0..1
}

/** Cocokkan skill CV vs requirement lowongan (exact kanonik + alias + substring aman). */
export function matchSkills(candidateSkills: string[], requiredSkills: string[]): AtsSkillResult {
  const req = (requiredSkills ?? []).map((s) => String(s).trim()).filter(Boolean);
  const candKeys = new Set(candidateSkills.map(compareKey).filter(Boolean));
  // Set "tanpa pemisah" untuk mengatasi skill kandidat yang terpecah spasi.
  const candKeysNs = new Set(Array.from(candKeys).map((k) => k.replace(/\s+/g, '')).filter(Boolean));
  const matched: string[] = [];
  const missing: string[] = [];
  for (const r of req) {
    const key = compareKey(r);
    const keyNs = key.replace(/\s+/g, '');
    // Cocok bila: kanonik sama, key sama, varian tanpa spasi sama, atau salah
    // satu substring yang lain (min 4 huruf agar tidak over-match "Go" vs "Google").
    const hit = candKeys.has(key) || candKeysNs.has(keyNs) ||
      Array.from(candKeys).some((ck) => {
        if (!ck || !key) return false;
        const ckNs = ck.replace(/\s+/g, '');
        return (ckNs.length >= 4 && keyNs.includes(ckNs)) || (keyNs.length >= 4 && ckNs.includes(keyNs));
      });
    (hit ? matched : missing).push(r);
  }
  const matchRatio = req.length === 0 ? 0 : matched.length / req.length;
  return { required: req, matched, missing, matchRatio };
}

export interface AtsScoreBreakdown {
  skills: number;      // 0..1
  contact: number;     // 0..1
  experience: number;  // 0..1
  education: number;   // 0..1
  summary: number;     // 0..1
}

export interface AtsResult {
  score: number;               // 0..100
  breakdown: AtsScoreBreakdown;
  matched: string[];
  missing: string[];
  required: string[];
  parsed: ParsedResume;
}

const WEIGHTS = { skills: 0.6, contact: 0.1, experience: 0.15, education: 0.1, summary: 0.05 };

/**
 * Hitung skor ATS dari hasil parsing + requirement lowongan.
 * Deterministik; tiap komponen 0..1 lalu dibobot.
 */
export function computeAtsScore(parsed: ParsedResume, requiredSkills: string[]): AtsResult {
  const skillResult = matchSkills(parsed.skills ?? [], requiredSkills);

  // Kontak: email + telepon (opsional: link profil menambah sedikit).
  const contactSignals = [
    !!parsed.contact?.email,
    !!parsed.contact?.phone,
    !!(parsed.contact?.linkedinUrl || parsed.contact?.portfolioUrl),
  ].filter(Boolean).length;
  const contact = contactSignals / 3;

  // Pengalaman: 0 tahun → 0; >= 3 tahun → 1 (linear).
  const years = parsed.totalExperienceYears ?? 0;
  const experience = Math.max(0, Math.min(1, years / 3));

  // Pendidikan: tingkat tertinggi (S3=1, S2=0.85, S1=0.7, D3=0.5, SMA=0.3, tak ada=0.1).
  const degreeRank: Record<string, number> = { S3: 1, S2: 0.85, S1: 0.7, D3: 0.5, 'SMA/SMK': 0.3 };
  const degrees = (parsed.educations ?? []).map((e) => e.degree).filter(Boolean) as string[];
  const bestDegree = degrees.reduce((best, d) => Math.max(best, degreeRank[d] ?? 0), 0);
  const education = degrees.length === 0 ? 0.1 : Math.max(0.3, bestDegree);

  // Ringkasan: ada teks bermakna → 1, tidak ada → 0.
  const summary = parsed.summary && parsed.summary.trim().length >= 40 ? 1 : 0;

  const breakdown: AtsScoreBreakdown = {
    skills: skillResult.matchRatio,
    contact,
    experience,
    education,
    summary,
  };

  const weighted =
    breakdown.skills * WEIGHTS.skills +
    breakdown.contact * WEIGHTS.contact +
    breakdown.experience * WEIGHTS.experience +
    breakdown.education * WEIGHTS.education +
    breakdown.summary * WEIGHTS.summary;

  const score = Math.round(Math.max(0, Math.min(1, weighted)) * 100 * 100) / 100;

  return {
    score,
    breakdown,
    matched: skillResult.matched,
    missing: skillResult.missing,
    required: skillResult.required,
    parsed,
  };
}

// ---------------------------------------------------------------------------
// Persistensi & orkestrasi
// ---------------------------------------------------------------------------

export interface AtsPersistInput {
  candidateId: string;
  applicationId?: string | null;
  fileName?: string;
  fileUrl?: string;
  rawText: string;
  parsed: ParsedResume;
  result: AtsResult;
}

/** Simpan hasil ATS ke `resume_parses`. Mengembalikan id baris (atau null bila gagal). */
export async function saveResumeParse(db: Db, input: AtsPersistInput): Promise<string | null> {
  try {
    const res = (await db.execute(sql`
      INSERT INTO resume_parses
        (candidate_id, application_id, file_name, file_url, raw_text, parsed_json,
         ats_score, matched_skills, missing_skills, parser)
      VALUES
        (${input.candidateId}::uuid, ${input.applicationId ?? null}::uuid, ${input.fileName ?? null},
         ${input.fileUrl ?? null}, ${input.rawText.slice(0, 40000)}, ${JSON.stringify(input.parsed)}::jsonb,
         ${input.result.score}, ${JSON.stringify(input.result.matched)}::jsonb,
         ${JSON.stringify(input.result.missing)}::jsonb, ${input.parsed.parser})
      RETURNING id
    `)) as unknown as { rows: Array<{ id: string }> };
    return res.rows?.[0]?.id ?? null;
  } catch (err) {
    console.warn('[atsService] gagal menyimpan resume_parses:', (err as Error)?.message);
    return null;
  }
}

/** Sinkronkan profil kandidat dari hasil parsing (skills/educations/experiences). */
export async function syncCandidateProfile(db: Db, candidateId: string, parsed: ParsedResume): Promise<void> {
  try {
    // Ringkasan & link (bila kosong) di tabel candidates.
    await db.execute(sql`
      UPDATE candidates
         SET summary = COALESCE(summary, ${parsed.summary ?? null}),
             linkedin_url = COALESCE(linkedin_url, ${parsed.contact?.linkedinUrl ?? null}),
             portfolio_url = COALESCE(portfolio_url, ${parsed.contact?.portfolioUrl ?? null}),
             phone = COALESCE(phone, ${parsed.contact?.phone ?? null})
       WHERE id = ${candidateId}::uuid
    `);

    for (const skill of (parsed.skills ?? []).slice(0, 40)) {
      await db.execute(sql`
        INSERT INTO candidate_skills (candidate_id, skill_name, source)
        VALUES (${candidateId}::uuid, ${skill}, 'ATS')
        ON CONFLICT (candidate_id, skill_name) DO NOTHING
      `);
    }

    // Educations & experiences: ganti agar idempoten (hindari duplikat saat re-parse).
    if ((parsed.educations ?? []).length > 0) {
      await db.execute(sql`DELETE FROM candidate_educations WHERE candidate_id = ${candidateId}::uuid`);
      for (const e of parsed.educations.slice(0, 5)) {
        await db.execute(sql`
          INSERT INTO candidate_educations (candidate_id, institution, degree, major, start_year, end_year, gpa)
          VALUES (${candidateId}::uuid, ${e.institution ?? null}, ${e.degree ?? null}, ${e.major ?? null},
                  ${e.startYear ?? null}, ${e.endYear ?? null}, ${e.gpa ?? null})
        `);
      }
    }
    if ((parsed.experiences ?? []).length > 0) {
      await db.execute(sql`DELETE FROM candidate_experiences WHERE candidate_id = ${candidateId}::uuid`);
      for (const x of parsed.experiences.slice(0, 10)) {
        await db.execute(sql`
          INSERT INTO candidate_experiences (candidate_id, company, role_title, start_date, end_date, description)
          VALUES (${candidateId}::uuid, ${x.company ?? null}, ${x.roleTitle ?? null},
                  ${x.startDate ?? null}::date, ${x.endDate ?? null}::date, ${x.description ?? null})
        `);
      }
    }
  } catch (err) {
    console.warn('[atsService] gagal sinkronisasi profil kandidat:', (err as Error)?.message);
  }
}

export interface RunAtsInput {
  candidateId: string;
  applicationId?: string | null;
  jobPostingId?: string | null;
  resumeText: string;
  fileName?: string;
  fileUrl?: string;
  /** Requirement skill lowongan; bila kosong, diambil dari job_postings. */
  requiredSkills?: string[];
  useAi?: boolean;
}

/**
 * Orkestrasi lengkap: ambil requirement → parse → skor → simpan → sinkronkan.
 * Selalu mengembalikan AtsResult (fallback: skor 0 tanpa error).
 */
export async function runAts(db: Db, input: RunAtsInput): Promise<AtsResult> {
  let required = input.requiredSkills ?? [];
  if (required.length === 0 && input.jobPostingId) {
    try {
      const r = (await db.execute(sql`
        SELECT required_skills AS "requiredSkills" FROM job_postings WHERE id = ${input.jobPostingId}::uuid
      `)) as unknown as { rows: Array<{ requiredSkills: unknown }> };
      const raw = r.rows?.[0]?.requiredSkills;
      if (Array.isArray(raw)) required = raw.map((s) => String(s));
      else if (typeof raw === 'string') {
        try { required = JSON.parse(raw); } catch { required = []; }
      }
    } catch {
      required = [];
    }
  }

  const text = normalizeResumeText(input.resumeText ?? '');
  const parsed = await parseResume(text, { useAi: input.useAi ?? true });
  // Pastikan skill gabungan kamus + requirement juga dideteksi dari teks.
  const extra = extractSkills(text);
  const skillSet = new Set<string>([...(parsed.skills ?? []), ...extra]);
  parsed.skills = Array.from(skillSet);

  const result = computeAtsScore(parsed, required);

  await saveResumeParse(db, {
    candidateId: input.candidateId,
    applicationId: input.applicationId ?? null,
    fileName: input.fileName,
    fileUrl: input.fileUrl,
    rawText: text,
    parsed,
    result,
  });
  await syncCandidateProfile(db, input.candidateId, parsed);

  // Timeline: tandai tahap ATS_REVIEW selesai (beserta skornya) bila ada lamaran.
  if (input.applicationId) {
    try {
      const { upsertStage } = await import('@/lib/services/timelineService');
      await upsertStage(db, {
        applicationId: input.applicationId,
        stage: 'ATS_REVIEW',
        status: 'PASSED',
        note: `Skor ATS: ${result.score.toFixed(0)}/100`,
      });
    } catch {
      /* timeline opsional */
    }
  }

  return result;
}