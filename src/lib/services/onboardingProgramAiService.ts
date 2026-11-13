/**
 * Onboarding Program AI (WS-8 lanjutan) — kurikulum onboarding per-posisi yang
 * DIGENERATE nyata (bukan demo), memakai AI bila tersedia dan fallback
 * deterministik bila tidak.
 *
 * Alur:
 *  1. Bangun konteks posisi: judul, departemen, skill wajib lowongan.
 *  2. Minta AI menyusun modul onboarding (judul, urutan, tipe, isi materi, kuis).
 *  3. Persist sebagai `moodle_courses` (fase PRE, mandatori) + `course_modules`.
 *  4. Tautkan kursus sebagai WAJIB posisi (`position_courses`).
 *
 * Idempoten: memakai kode kursus deterministik `ONB-<POSITION>` sehingga
 * pemanggilan ulang tidak menduplikasi kursus/modul.
 */
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { matchOerResources, validateModuleUrl, type OerResource } from '@/lib/services/oerCatalogService';
import { periksaStatisOer } from '@/lib/services/oerLinkValidator';
import { plmReferenceForPrompt } from '@/lib/services/companyLearningCatalog';

export interface GeneratedModule {
  title: string;
  orderIndex: number;
  contentType: 'TEXT' | 'VIDEO' | 'PDF' | 'QUIZ';
  contentBody: string | null;
  contentUrl: string | null;
  /** Kunci jawaban kuis: array { q, a } (indeks opsi benar). Hanya untuk QUIZ. */
  quizKey: Array<{ q: number; a: number }> | null;
}

export interface GeneratedProgram {
  courseId: number;
  courseCode: string;
  title: string;
  modules: GeneratedModule[];
  created: boolean;
  aiUsed: boolean;
}

/**
 * Kode kursus onboarding deterministik per posisi (idempoten).
 *
 * Memakai id posisi LENGKAP. Sebelumnya hanya 8 huruf pertama, padahal semua
 * id posisi seed berawalan sama (a0000000-…), sehingga SELURUH posisi berbagi
 * satu kode ONB-A0000000: posisi pertama membuat kursus, posisi berikutnya
 * memakai ulang kursus posisi LAIN — akibatnya Compensation & Benefit
 * Specialist mendapat kurikulum Chief Internal Auditor.
 */
function onboardingCourseCode(positionId: string): string {
  return `ONB-${positionId.replace(/-/g, '').toUpperCase()}`;
}

/** Bentuk soal kuis yang disimpan di `content_body` (kunci jawaban TIDAK dikirim). */
export interface QuizQuestion {
  text: string;
  options: string[];
}

/** Serialisasi soal kuis ke `content_body` (JSON) agar UI dapat menampilkan tanpa membocorkan kunci. */
export function quizContentBody(questions: QuizQuestion[]): string {
  return JSON.stringify({ questions });
}

interface PositionContext {
  positionTitle: string;
  department: string | null;
  requiredSkills: string[];
}

async function loadPositionContext(db: Db, positionId: string): Promise<PositionContext | null> {
  const res = (await db.execute(sql`
    SELECT p.position_title AS "positionTitle", d.department_name AS "department"
      FROM job_positions p
      LEFT JOIN departments d ON d.id = p.department_id
     WHERE p.id = ${positionId}::uuid
  `)) as unknown as { rows: Array<{ positionTitle: string; department: string | null }> };
  const row = res.rows?.[0];
  if (!row) return null;

  // Skill wajib diambil dari lowongan terkait posisi (bila ada) — konteks nyata.
  const skills = (await db.execute(sql`
    SELECT jp.required_skills AS "requiredSkills"
      FROM job_postings jp WHERE jp.position_id = ${positionId}::uuid
     ORDER BY jp.posted_at DESC NULLS LAST LIMIT 1
  `)) as unknown as { rows: Array<{ requiredSkills: unknown }> };
  let requiredSkills: string[] = [];
  const raw = skills.rows?.[0]?.requiredSkills;
  if (Array.isArray(raw)) requiredSkills = raw.map((x) => (typeof x === 'string' ? x : (x as any)?.name ?? '')).filter(Boolean);
  else if (typeof raw === 'string') { try { const p = JSON.parse(raw); if (Array.isArray(p)) requiredSkills = p.map(String); } catch { /* ignore */ } }
  return { positionTitle: row.positionTitle, department: row.department ?? null, requiredSkills };
}

/**
 * Modul materi gratis (OER) yang dicocokkan dengan skill/topik posisi. Tautan
 * berasal dari katalog tepercaya (OpenLearn, Microsoft Learn, dsb.) sehingga
 * selalu https + domain di-whitelist.
 *
 * Aturan bahasa:
 *  - JUDUL & penjelasan modul memakai Bahasa Indonesia (agar HR dan karyawan
 *    memahami maksudnya).
 *  - Nama asli kursus (bila berbahasa Inggris) tetap dicantumkan dalam tanda
 *    kurung sebagai rujukan, karena materi penyedia memang berbahasa Inggris.
 */
export function oerModulesForContext(ctx: PositionContext, startIndex: number, max = 2): GeneratedModule[] {
  const keywords = [ctx.positionTitle, ...ctx.requiredSkills].map((s) => String(s));
  const resources = matchOerResources(keywords, max);
  return resources.map((res: OerResource, i) => ({
    title: `${judulModulIndonesia(ctx.positionTitle, i)} — ${res.title}`,
    orderIndex: startIndex + i,
    contentType: 'VIDEO' as const,
    contentBody:
      `Materi gratis dari ${res.provider}. ` +
      `Pelajari materi ini sebagai bagian dari pengembangan kompetensi ${ctx.positionTitle}. ` +
      (res.title !== res.title.toLowerCase()
        ? `Materi penyedia berjudul asli "${res.title}".`
        : ''),
    contentUrl: res.url,
    quizKey: null,
  }));
}

/** Judul modul berbahasa Indonesia yang bervariasi menurut urutan. */
function judulModulIndonesia(positionTitle: string, urutan: number): string {
  const pola = [
    `Pengantar Kompetensi ${positionTitle}`,
    `Pendalaman Materi ${positionTitle}`,
    `Praktik Terbaik ${positionTitle}`,
    `Studi Kasus ${positionTitle}`,
    `Evaluasi Pemahaman ${positionTitle}`,
  ];
  return pola[urutan % pola.length];
}

/**
 * Fallback deterministik bila AI tak tersedia: kurikulum orientasi standar
 * dengan kuis yang benar-benar memiliki kunci jawaban + modul materi OER gratis.
 */
export function fallbackModules(ctx: PositionContext): GeneratedModule[] {
  const role = ctx.positionTitle || 'Karyawan Baru';
  const dept = ctx.department ? ` (${ctx.department})` : '';
  const quizQuestions: QuizQuestion[] = [
    { text: 'Mana yang termasuk nilai inti AKHLAK?', options: ['Amanah', 'Individualis', 'Kompetitif ekstrem', 'Netral'] },
    { text: `Apa yang menjadi fokus utama masa onboarding posisi ${role}?`, options: ['Adaptasi budaya & kompetensi dasar', 'Cuti tahunan', 'Resign dini', 'Abaikan SOP'] },
    { text: 'Saluran yang benar bila menemukan dugaan pelanggaran kode etik?', options: ['Diam saja', 'Saluran pelaporan/whistleblowing', 'Sosial media', 'Rekan kerja sebagai hakim'] },
  ];
  const oer = oerModulesForContext(ctx, 4, 2); // orderIndex 4-5
  const quizIndex = 4 + oer.length;
  return [
    {
      title: `Selamat Datang & Peran ${role}`,
      orderIndex: 1,
      contentType: 'TEXT',
      contentBody: `Modul ini memperkenalkan struktur organisasi, budaya kerja, tata kelola GCG, dan ekspektasi peran sebagai ${role}${dept}. Pahami alur pelaporan, saluran komunikasi, serta kode etik perusahaan sebelum mulai bekerja.`,
      contentUrl: null,
      quizKey: null,
    },
    {
      title: 'Nilai AKHLAK & Kode Etik',
      orderIndex: 2,
      contentType: 'TEXT',
      contentBody: 'Amanah, Kompeten, Harmonis, Loyal, Adaptif, Kolaboratif. Pelajari penerapan tiap nilai dalam interaksi sehari-hari, pengambilan keputusan, dan penanganan konflik kepentingan.',
      contentUrl: null,
      quizKey: null,
    },
    {
      title: `Kompetensi Inti ${role}`,
      orderIndex: 3,
      contentType: 'TEXT',
      contentBody: `Ringkasan kompetensi inti untuk posisi ${role}${dept}: ${ctx.requiredSkills.length ? ctx.requiredSkills.join(', ') : 'komunikasi, kolaborasi, dan orientasi hasil'}. Modul ini menjadi dasar penilaian kompetensi pada masa percobaan.`,
      contentUrl: null,
      quizKey: null,
    },
    ...oer,
    {
      title: 'Kuis Orientasi & Kepatuhan',
      orderIndex: quizIndex,
      contentType: 'QUIZ',
      contentBody: quizContentBody(quizQuestions),
      contentUrl: null,
      quizKey: [
        { q: 1, a: 0 },
        { q: 2, a: 0 },
        { q: 3, a: 1 },
      ],
    },
  ];
}

/** Prompt AI untuk menyusun modul onboarding. */
function buildPrompt(ctx: PositionContext, count: number): string {
  const plmReference = plmReferenceForPrompt(ctx.positionTitle, ctx.requiredSkills);
  const data = {
    posisi: ctx.positionTitle,
    departemen: ctx.department,
    skillWajib: ctx.requiredSkills,
    jumlahModul: count,
    acuanProfessionalLearningModulePerusahaan: plmReference,
  };
  return (
    'Anda menyusun kurikulum onboarding pra-kerja (fase Sebelum Kerja) untuk karyawan baru HR Command Center. Data (JSON):\n' +
    JSON.stringify(data) +
    `\n\nGunakan "acuanProfessionalLearningModulePerusahaan" di atas sebagai RUJUKAN WAJIB agar modul selaras dengan jalur pembelajaran profesional perusahaan, bukan topik mengada-ada. ` +
    `\n\nBuat TEPAT ${count} modul onboarding berurutan. Keluaran HARUS berupa JSON ARRAY valid tanpa teks lain, ` +
    'tanpa blok kode markdown. Setiap elemen:\n' +
    '{"title": string, "contentType": "TEXT"|"VIDEO"|"PDF"|"QUIZ", "contentBody": string (materi singkat 2-4 kalimat, untuk QUIZ berisi JSON {"questions":[{"text":...,"options":["...","..."]}]}), ' +
    '"contentUrl": string|null (untuk VIDEO/PDF isi tautan materi GRATIS yang relevan dari domain tepercaya seperti OpenLearn (open.edu), Microsoft Learn (learn.microsoft.com), AWS, Google Cloud, freeCodeCamp, MIT OCW, atau roadmap.sh; selain VIDEO/PDF isi null), ' +
    '"quizKey": null atau [{"q":1,"a":0},{"q":2,"a":1},{"q":3,"a":2}] (indeks opsi benar)\n' +
    'Modul terakhir WAJIB contentType "QUIZ" dengan TEPAT 3 soal pilihan ganda (masing-masing 4 opsi). ' +
    'Bila memakai contentType "VIDEO" atau "PDF", contentUrl WAJIB diisi tautan https dari domain tepercaya di atas. ' +
    'Materi harus spesifik untuk posisi & skill wajib di atas, praktis, dan berbahasa Indonesia. ' +
    'Jangan mengarang data di luar konteks.'
  );
}

/** Ekstrak JSON array dari keluaran model (toleran terhadap pembungkus teks). */
export function parseModules(raw: string, ctx: PositionContext): GeneratedModule[] {
  const text = String(raw ?? '').trim();
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return fallbackModules(ctx);
  let arr: any;
  try { arr = JSON.parse(text.slice(start, end + 1)); } catch { return fallbackModules(ctx); }
  if (!Array.isArray(arr) || arr.length === 0) return fallbackModules(ctx);

  const valid: GeneratedModule[] = [];
  arr.forEach((m: any, i: number) => {
    const title = typeof m?.title === 'string' && m.title.trim() ? m.title.trim().slice(0, 240) : null;
    if (!title) return;
    const ct = ['TEXT', 'VIDEO', 'PDF', 'QUIZ'].includes(m?.contentType) ? m.contentType : 'TEXT';
    let quizKey: Array<{ q: number; a: number }> | null = null;
    let contentBody: string | null = typeof m?.contentBody === 'string' ? m.contentBody.trim().slice(0, 8000) : '';
    // Tautan OER: hanya untuk VIDEO/PDF dan WAJIB lolos whitelist domain
    // tepercaya SEKALIGUS bukan penyedia berbayar / halaman pembelian.
    let contentUrl: string | null = typeof m?.contentUrl === 'string' && m.contentUrl.trim() ? m.contentUrl.trim().slice(0, 500) : null;
    let finalCt = ct;
    if (ct === 'VIDEO' || ct === 'PDF') {
      const lolosDomain = validateModuleUrl(ct, contentUrl).ok;
      const lolosGratis = contentUrl ? periksaStatisOer(contentUrl).gratis : false;
      if (!lolosDomain || !lolosGratis) {
        // Tautan tidak valid/berbayar → turunkan ke TEXT agar modul tetap bermakna.
        finalCt = 'TEXT';
        contentUrl = null;
      }
    } else {
      contentUrl = null;
    }
    if (finalCt === 'QUIZ') {
      let keys: Array<{ q: number; a: number }> = Array.isArray(m?.quizKey)
        ? m.quizKey.filter((x: any) => typeof x?.q === 'number' && typeof x?.a === 'number').map((x: any) => ({ q: Number(x.q), a: Number(x.a) }))
        : [];
      if (keys.length === 0) keys = [{ q: 1, a: 0 }, { q: 2, a: 1 }, { q: 3, a: 2 }];
      // Sanitasi soal dari contentBody (JSON {questions:[{text,options}]}); fallback bila tak valid.
      const qs = sanitizeQuizBody(contentBody);
      if (qs.length === 0) {
        contentBody = quizContentBody(defaultQuizQuestions('posisi ini'));
        keys = [{ q: 1, a: 0 }, { q: 2, a: 0 }, { q: 3, a: 1 }];
      } else {
        // Selaraskan jumlah kunci dengan jumlah soal; lengkapi bila perlu.
        while (keys.length < qs.length) keys.push({ q: keys.length + 1, a: 0 });
        keys = keys.slice(0, qs.length);
        contentBody = quizContentBody(qs);
      }
      quizKey = keys;
    }
    valid.push({
      title,
      orderIndex: i + 1,
      contentType: finalCt,
      contentBody: finalCt === 'QUIZ' ? contentBody : (contentBody ?? ''),
      contentUrl,
      quizKey,
    });
  });
  // Pastikan minimal ada satu modul & minimal satu QUIZ (agar gate nyata).
  if (valid.length === 0) return fallbackModules(ctx);
  if (!valid.some((m) => m.contentType === 'QUIZ')) {
    valid.push({
      title: 'Kuis Orientasi & Kepatuhan',
      orderIndex: valid.length + 1,
      contentType: 'QUIZ',
      contentBody: quizContentBody(defaultQuizQuestions(ctx.positionTitle || 'posisi ini')),
      contentUrl: null,
      quizKey: [{ q: 1, a: 0 }, { q: 2, a: 0 }, { q: 3, a: 1 }],
    });
  }
  return valid;
}

/** Pertanyaan kuis default (deterministik) bila AI tak menyuplai soal yang valid. */
function defaultQuizQuestions(role: string): QuizQuestion[] {
  return [
    { text: 'Mana yang termasuk nilai inti AKHLAK?', options: ['Amanah', 'Individualis', 'Kompetitif ekstrem', 'Netral'] },
    { text: `Apa fokus utama masa onboarding posisi ${role}?`, options: ['Adaptasi budaya & kompetensi dasar', 'Cuti tahunan', 'Resign dini', 'Abaikan SOP'] },
    { text: 'Saluran yang benar bila menemukan dugaan pelanggaran kode etik?', options: ['Diam saja', 'Saluran pelaporan/whistleblowing', 'Sosial media', 'Rekan kerja sebagai hakim'] },
  ];
}

/** Ambil + validasi soal kuis dari `content_body` (JSON {questions}). */
function sanitizeQuizBody(body: string | null): QuizQuestion[] {
  if (!body) return [];
  try {
    const parsed = JSON.parse(body);
    const qs = parsed?.questions;
    if (!Array.isArray(qs)) return [];
    const out: QuizQuestion[] = [];
    for (const q of qs) {
      const text = typeof q?.text === 'string' ? q.text.trim().slice(0, 300) : '';
      const options = Array.isArray(q?.options) ? q.options.filter((o: any) => typeof o === 'string').map((o: string) => o.trim().slice(0, 160)).filter(Boolean) : [];
      if (text && options.length >= 2) out.push({ text, options: options.slice(0, 6) });
    }
    return out.slice(0, 10);
  } catch {
    return [];
  }
}

/**
 * Membuat (idempoten) kursus onboarding per-posisi + modul-modulnya.
 * Pakai AI bila terkonfigurasi; jika tidak, fallback deterministik tetap nyata.
 */
export async function generatePositionOnboardingCourse(
  db: Db,
  positionId: string,
  opts: { useAi?: boolean; moduleCount?: number } = {},
): Promise<GeneratedProgram | null> {
  const ctx = await loadPositionContext(db, positionId);
  if (!ctx) return null;

  const courseCode = onboardingCourseCode(positionId);
  const title = `Onboarding ${ctx.positionTitle}`;
  const count = Math.min(Math.max(opts.moduleCount ?? 4, 3), 8);

  // Modul: AI bila diminta & terkonfigurasi, kalau tidak fallback.
  let modules = fallbackModules(ctx);
  let aiUsed = false;
  if (opts.useAi !== false) {
    try {
      const { generateContent, isAiConfigured } = await import('@/lib/services/aiService');
      if (isAiConfigured()) {
        const res = await generateContent(buildPrompt(ctx, count), { maxOutputTokens: 2000, temperature: 0.3 });
        if (res?.text && res.text.trim()) {
          modules = parseModules(res.text, ctx);
          aiUsed = true;
        }
      }
    } catch {
      /* fallback deterministik tetap dipakai */
    }
  }

  // Jika AI tidak menyertakan modul materi OER (VIDEO/PDF), tambahkan dari katalog
  // tepercaya agar kurikulum selalu memuat materi gratis yang relevan dengan posisi.
  if (opts.useAi !== false && aiUsed && !modules.some((m) => m.contentType === 'VIDEO' || m.contentType === 'PDF')) {
    const quiz = modules.find((m) => m.contentType === 'QUIZ');
    const oer = oerModulesForContext(ctx, modules.length + 1, 2);
    const reindexed = modules.map((m) => m);
    // Sisipkan OER tepat sebelum modul QUIZ (bila ada).
    const insertAt = quiz ? reindexed.indexOf(quiz) : reindexed.length;
    reindexed.splice(insertAt, 0, ...oer);
    modules = reindexed.map((m, i) => ({ ...m, orderIndex: i + 1 }));
  }

  const existing = (await db.execute(sql`
    SELECT id FROM moodle_courses WHERE course_code = ${courseCode}
  `)) as unknown as { rows: Array<{ id: number }> };
  let courseId: number;
  let created = false;
  if (existing.rows[0]) {
    courseId = Number(existing.rows[0].id);
  } else {
    const ins = (await db.execute(sql`
      INSERT INTO moodle_courses (course_code, title, category, description, target_phase, is_mandatory, default_hours, level_min)
      VALUES (${courseCode}, ${title}, 'Onboarding',
              ${`Kurikulum onboarding pra-kerja untuk ${ctx.positionTitle}${ctx.department ? ` (${ctx.department})` : ''}.`},
              'PRE'::course_phase_enum, TRUE, ${modules.length * 2}, 1)
      RETURNING id
    `)) as unknown as { rows: Array<{ id: number }> };
    courseId = Number(ins.rows[0].id);
    created = true;
  }

  // Modul: hanya tulis bila kursus baru dibuat (idempoten).
  if (created) {
    for (const m of modules) {
      await db.execute(sql`
        INSERT INTO course_modules (course_id, title, order_index, content_type, content_url, content_body, quiz_key)
        VALUES (${courseId}, ${m.title}, ${m.orderIndex}, ${m.contentType}::content_type_enum,
                ${m.contentUrl}, ${m.contentBody}, ${m.quizKey ? JSON.stringify(m.quizKey) : null}::jsonb)
      `);
    }
  }

  // Tautkan sebagai kursus WAJIB posisi (idempoten).
  await db.execute(sql`
    INSERT INTO position_courses (position_id, course_id, is_mandatory, order_index, note)
    VALUES (${positionId}::uuid, ${courseId}, TRUE, 0, 'Kurikulum onboarding hasil generate')
    ON CONFLICT (position_id, course_id) DO NOTHING
  `);

  return { courseId, courseCode, title, modules, created, aiUsed };
}
