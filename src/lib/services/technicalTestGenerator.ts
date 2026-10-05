/**
 * WS-4 — Generator soal tes teknis (40%) via AI, dengan gerbang persetujuan HR.
 *
 * Alur:
 *  1. HR memilih sebuah lowongan (`job_postings`) yang punya `required_skills`.
 *  2. Service menyusun prompt ketat → `aiService.generateContent` (best-effort).
 *  3. Jawaban JSON di-parse toleran → soal MCQ disimpan sebagai **DRAFT**
 *     (`is_active = FALSE`) pada template TECHNICAL posisi tersebut.
 *  4. HR me-review lalu `approveQuestion` → `is_active = TRUE` (baru terlihat kandidat).
 *
 * Prinsip:
 *  - Best-effort: AI mati/gagal/bukan-JSON → `{ generated: 0 }`, TIDAK pernah throw 500.
 *  - Manual fallback tetap ada: soal lama/manual tidak disentuh (insert bersifat aditif).
 *  - Driver-agnostic (PGlite & PostgreSQL) lewat `Db`.
 */
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { generateContent, isAiConfigured } from '@/lib/services/aiService';
import { BusinessRuleError, NotFoundError } from '@/lib/auth/errors';

export type QuestionDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type QuestionLanguage = 'id' | 'en';

export interface GenerateTechnicalQuestionsOptions {
  positionId: string;
  count?: number;
  difficulty?: QuestionDifficulty;
  language?: QuestionLanguage;
  /** Opsi audit (WS-5); opsional agar signature tetap sesuai rencana. */
  generatedBy?: string;
}

export interface GenerateTechnicalQuestionsResult {
  generated: number;
  questionIds: string[];
  aiUsed: boolean;
}

export interface DraftQuestion {
  id: string;
  prompt: string;
  options: Array<{ key: string; label: string }> | null;
  correctKey: string | null;
  difficulty: string | null;
  skillTag: string | null;
}

interface ParsedQuestion {
  prompt: string;
  options: Record<string, string>;
  correctKey: string;
  difficulty: string;
  skillTag: string | null;
}

const DEFAULT_COUNT = 5;
const MIN_COUNT = 1;
const MAX_COUNT = 20;

/** Template TECHNICAL generik bila posisi belum punya template sendiri. */
const GENERIC_TECHNICAL_CODES = ['TECH-GEN', 'TECHNICAL-GEN'];

async function rows<T>(db: Db, query: any): Promise<T[]> {
  const res = (await db.execute(query)) as unknown as { rows: T[] };
  return res.rows ?? [];
}

// ---------------------------------------------------------------------------
// Parsing toleran
// ---------------------------------------------------------------------------

/**
 * Ambil objek/array JSON pertama dari keluaran model. Tahan terhadap:
 * pagar markdown (```json ... ```), teks pengantar/penutup, dan thinking-strip
 * yang sudah dilakukan `aiService`.
 */
function safeJsonParse(raw: string): unknown | null {
  if (!raw) return null;
  let text = String(raw).trim();

  // Buang pagar markdown.
  text = text.replace(/```(?:json)?/gi, '').trim();

  // Coba langsung.
  const direct = tryParse(text);
  if (direct !== null) return direct;

  // Ambil dari '{' pertama sampai '}' terakhir.
  const firstObj = text.indexOf('{');
  const lastObj = text.lastIndexOf('}');
  if (firstObj !== -1 && lastObj > firstObj) {
    const sliced = tryParse(text.slice(firstObj, lastObj + 1));
    if (sliced !== null) return sliced;
  }

  // Fallback: array telanjang.
  const firstArr = text.indexOf('[');
  const lastArr = text.lastIndexOf(']');
  if (firstArr !== -1 && lastArr > firstArr) {
    const sliced = tryParse(text.slice(firstArr, lastArr + 1));
    if (sliced !== null) return sliced;
  }

  return null;
}

function tryParse(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function asString(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/** Normalisasi satu item mentah AI → ParsedQuestion, atau null bila tidak layak. */
function normalizeQuestion(raw: any, fallbackDifficulty: string): ParsedQuestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const prompt = asString(raw.prompt ?? raw.question ?? raw.text);
  if (!prompt) return null;

  // options dapat berupa objek {A,B,C,D} atau array [{key,label}].
  const options: Record<string, string> = {};
  const rawOpts = raw.options ?? raw.choices ?? raw.answers;
  if (Array.isArray(rawOpts)) {
    for (const o of rawOpts) {
      const key = asString(o?.key ?? o?.id).toUpperCase();
      const label = asString(o?.label ?? o?.text ?? o?.value);
      if (key && label) options[key] = label;
    }
  } else if (rawOpts && typeof rawOpts === 'object') {
    for (const [k, v] of Object.entries(rawOpts)) {
      const label = asString(v);
      if (label) options[k.toUpperCase()] = label;
    }
  }

  const keys = Object.keys(options);
  if (keys.length < 2) return null;

  // Kunci jawaban: correctKey | correct_key | answer | correct.
  let correctKey = asString(
    raw.correctKey ?? raw.correct_key ?? raw.answer ?? raw.correct ?? raw.correctAnswer,
  ).toUpperCase();
  // Bila yang diberi adalah label jawaban, cari key yang labelnya cocok.
  if (!options[correctKey]) {
    const byLabel = keys.find((k) => options[k].toLowerCase() === correctKey.toLowerCase());
    correctKey = byLabel ?? keys[0];
  }

  const difficulty = (asString(raw.difficulty) || fallbackDifficulty).toUpperCase();
  const skillTag = asString(raw.skillTag ?? raw.skill_tag) || null;

  return { prompt, options, correctKey, difficulty, skillTag };
}

/** Ekstrak daftar soal dari payload AI (menerima objek `{questions:[...]}` atau array). */
function extractQuestions(payload: unknown, count: number, fallbackDifficulty: string): ParsedQuestion[] {
  let list: unknown[] = [];
  if (Array.isArray(payload)) {
    list = payload;
  } else if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    const candidate = obj.questions ?? obj.items ?? obj.data ?? obj.soal;
    if (Array.isArray(candidate)) list = candidate;
  }

  const out: ParsedQuestion[] = [];
  for (const item of list) {
    const normalized = normalizeQuestion(item, fallbackDifficulty);
    if (normalized) out.push(normalized);
    if (out.length >= count) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildPrompt(params: {
  positionTitle: string;
  skills: string[];
  minEducation: string | null;
  minExperience: number | null;
  count: number;
  difficulty: string;
  language: QuestionLanguage;
}): string {
  const lang = params.language === 'en' ? 'English' : 'Bahasa Indonesia';
  const skills = params.skills.join(', ');
  const edu = params.minEducation || 'tidak ditentukan';
  const exp = params.minExperience != null ? `${params.minExperience} tahun` : 'tidak ditentukan';

  return [
    `Buat ${params.count} soal pilihan ganda (MCQ) untuk tes teknis posisi "${params.positionTitle}".`,
    `Kualifikasi wajib: ${skills}.`,
    `Pendidikan minimum: ${edu}. Pengalaman minimum: ${exp}.`,
    `Tingkat kesulitan: ${params.difficulty}.`,
    `Tulis soal dan opsi dalam ${lang}.`,
    '',
    'Aturan:',
    `- Setiap soal memiliki tepat 4 opsi: A, B, C, D.`,
    `- Hanya satu jawaban benar.`,
    `- Fokus pada kompetensi teknis yang relevan dengan kualifikasi di atas.`,
    '',
    'Balas HANYA dengan JSON valid (tanpa penjelasan, tanpa pagar markdown) dengan bentuk:',
    '{"questions":[{"prompt":"...","options":{"A":"...","B":"...","C":"...","D":"..."},"correctKey":"A","difficulty":"MEDIUM","skillTag":"..."}]}',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Lookup template & posisi
// ---------------------------------------------------------------------------

interface PostingRow {
  id: string;
  position_id: string;
  posting_title: string;
  required_skills: unknown;
  min_education: string | null;
  min_experience_years: number | null;
}

function parseSkills(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((s) => asString(s)).filter(Boolean);
  if (typeof value === 'string') {
    const parsed = safeJsonParse(value);
    if (Array.isArray(parsed)) return parsed.map((s) => asString(s)).filter(Boolean);
    return value.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

async function loadPosting(db: Db, positionId: string): Promise<PostingRow | null> {
  // `positionId` pada kontrak WS-4 = id job_postings (lowongan), sesuai test.
  const found = await rows<PostingRow>(db, sql`
    SELECT id, position_id, posting_title, required_skills,
           min_education, min_experience_years::float8 AS min_experience_years
      FROM job_postings
     WHERE id = ${positionId}::uuid
     LIMIT 1
  `);
  return found[0] ?? null;
}

/**
 * Template TECHNICAL untuk sebuah posisi: pilih yang spesifik posisi bila ada,
 * lalu fallback ke template generik (code TECH-GEN).
 */
async function resolveTechnicalTemplate(db: Db, positionId: string): Promise<{ id: string } | null> {
  const specific = await rows<{ id: string }>(db, sql`
    SELECT id FROM assessment_templates
     WHERE type = 'TECHNICAL'::assessment_type_enum
       AND is_active = TRUE
       AND position_id = ${positionId}::uuid
     ORDER BY created_at ASC
     LIMIT 1
  `);
  if (specific[0]) return specific[0];

  const generic = await rows<{ id: string }>(db, sql`
    SELECT id FROM assessment_templates
     WHERE type = 'TECHNICAL'::assessment_type_enum
       AND is_active = TRUE
       AND position_id IS NULL
     ORDER BY created_at ASC
     LIMIT 1
  `);
  if (generic[0]) return generic[0];

  // Terakhir: template TECHNICAL apa pun yang aktif.
  const any = await rows<{ id: string }>(db, sql`
    SELECT id FROM assessment_templates
     WHERE type = 'TECHNICAL'::assessment_type_enum AND is_active = TRUE
     ORDER BY created_at ASC
     LIMIT 1
  `);
  return any[0] ?? null;
}

// ---------------------------------------------------------------------------
// API publik
// ---------------------------------------------------------------------------

/**
 * Generate soal teknis via AI untuk sebuah lowongan dan simpan sebagai DRAFT.
 * Best-effort: AI tidak dikonfigurasi / gagal / keluaran bukan JSON → `generated: 0`.
 */
export async function generateTechnicalQuestions(
  db: Db,
  opts: GenerateTechnicalQuestionsOptions,
): Promise<GenerateTechnicalQuestionsResult> {
  const { positionId } = opts;
  const count = Math.min(Math.max(Math.trunc(opts.count ?? DEFAULT_COUNT) || DEFAULT_COUNT, MIN_COUNT), MAX_COUNT);
  const difficulty = (opts.difficulty ?? 'MEDIUM').toUpperCase();
  const language: QuestionLanguage = opts.language === 'en' ? 'en' : 'id';

  const posting = await loadPosting(db, positionId);
  if (!posting) {
    throw new BusinessRuleError('Posisi/lowongan tidak ditemukan untuk generate soal.');
  }

  const skills = parseSkills(posting.required_skills);
  if (skills.length === 0) {
    throw new BusinessRuleError(
      'Posisi ini belum punya kualifikasi (required_skills). Lengkapi kualifikasi sebelum generate soal.',
    );
  }

  // AI tidak aktif → jalur manual tetap dipakai (bukan error).
  if (!isAiConfigured()) {
    return { generated: 0, questionIds: [], aiUsed: false };
  }

  const template = await resolveTechnicalTemplate(db, posting.position_id);
  if (!template) {
    throw new BusinessRuleError('Template tes teknis untuk posisi ini tidak ditemukan.');
  }

  const prompt = buildPrompt({
    positionTitle: posting.posting_title,
    skills,
    minEducation: posting.min_education,
    minExperience: posting.min_experience_years,
    count,
    difficulty,
    language,
  });

  let aiText = '';
  try {
    const result = await generateContent(prompt, {
      maxOutputTokens: 2048,
      temperature: 0.4,
    });
    if (!result?.configured) {
      return { generated: 0, questionIds: [], aiUsed: false };
    }
    if (result.error) {
      // Best-effort: jangan lempar; HR tetap bisa isi manual.
      return { generated: 0, questionIds: [], aiUsed: false };
    }
    aiText = result.text ?? '';
  } catch {
    return { generated: 0, questionIds: [], aiUsed: false };
  }

  const payload = safeJsonParse(aiText);
  const parsed = extractQuestions(payload, count, difficulty);
  if (parsed.length === 0) {
    return { generated: 0, questionIds: [], aiUsed: true };
  }

  // Urutkan setelah soal terakhir template yang sama.
  const maxOrder = await rows<{ max_order: number | null }>(db, sql`
    SELECT MAX(order_index)::int AS max_order
      FROM assessment_questions WHERE template_id = ${template.id}::uuid
  `);
  let order = (maxOrder[0]?.max_order ?? 0) + 1;

  const questionIds: string[] = [];
  for (const q of parsed) {
    const optionsPayload = Object.entries(q.options).map(([key, label]) => ({ key, label }));
    const inserted = await rows<{ id: string }>(db, sql`
      INSERT INTO assessment_questions
        (template_id, order_index, type, prompt, options, correct_key,
         is_active, difficulty, skill_tag, source, source_ref)
      VALUES (
        ${template.id}::uuid, ${order}, 'MCQ'::question_type_enum, ${q.prompt},
        ${JSON.stringify(optionsPayload)}::jsonb, ${q.correctKey},
        FALSE, ${q.difficulty}, ${q.skillTag}, 'AI', ${posting.id}
      )
      RETURNING id
    `);
    if (inserted[0]) questionIds.push(inserted[0].id);
    order += 1;
  }

  // Catatan: `generatedBy` tersedia untuk audit WS-5 namun belum dipersist;
  // kolom audit (approved_by) diisi saat HR menyetujui soal.

  return { generated: questionIds.length, questionIds, aiUsed: true };
}

/**
 * Daftar soal DRAFT (is_active = FALSE) untuk posisi tertentu.
 */
export async function listDraftQuestions(db: Db, positionId: string): Promise<DraftQuestion[]> {
  const posting = await loadPosting(db, positionId);
  if (!posting) return [];

  const template = await resolveTechnicalTemplate(db, posting.position_id);
  if (!template) return [];

  const drafts = await rows<any>(db, sql`
    SELECT id, prompt, options, correct_key, difficulty, skill_tag
      FROM assessment_questions
     WHERE template_id = ${template.id}::uuid
       AND is_active = FALSE
     ORDER BY order_index ASC
  `);

  return drafts.map((d) => ({
    id: d.id,
    prompt: d.prompt,
    options: Array.isArray(d.options) ? d.options : null,
    correctKey: d.correct_key ?? null,
    difficulty: d.difficulty ?? null,
    skillTag: d.skill_tag ?? null,
  }));
}

/**
 * Setujui sebuah soal DRAFT → aktif (`is_active = TRUE`) agar dipakai kandidat.
 * Melempar `NotFoundError` (404) bila soal tidak ada.
 */
export async function approveQuestion(
  db: Db,
  questionId: string,
  opts: { approvedBy: string },
): Promise<{ ok: true }> {
  const existing = await rows<{ id: string }>(db, sql`
    SELECT id FROM assessment_questions WHERE id = ${questionId}::uuid LIMIT 1
  `);
  if (!existing[0]) {
    throw new NotFoundError('Soal tidak ditemukan.');
  }

  // `approvedBy` dapat berupa UUID user; bila bukan UUID valid, simpan NULL (jangan crash).
  const approvedBy =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(opts.approvedBy)
      ? opts.approvedBy
      : null;

  await rows(db, sql`
    UPDATE assessment_questions
       SET is_active = TRUE,
           approved_at = CURRENT_TIMESTAMP,
           approved_by = ${approvedBy}::uuid
     WHERE id = ${questionId}::uuid
  `);

  return { ok: true };
}

export { GENERIC_TECHNICAL_CODES };
