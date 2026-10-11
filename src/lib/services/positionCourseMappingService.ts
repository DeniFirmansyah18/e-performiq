/**
 * Position–Course Mapping Service (Jalur A) — HR memetakan kursus ke tiap posisi.
 *
 * Sumber kebenaran: tabel `position_courses` (position_id ↔ course_id). Mapping
 * ini yang membuat "kursus sesuai posisi" berjalan penuh saat HR membuat program
 * onboarding karyawan (`generateOnboardingProgram`).
 *
 * Operasi CRUD idempoten (ON CONFLICT), driver-agnostic (PGlite/Postgres).
 */
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { listPositionCourses, type PositionCourse } from '@/lib/services/onboardingService';

export interface PositionWithCourses {
  positionId: string;
  title: string;
  departmentName: string | null;
  mappedCount: number;
  courses: PositionCourse[];
}

export interface CourseOption {
  courseId: number;
  courseCode: string;
  title: string;
  category: string | null;
  targetPhase: string;
  isMandatoryDefault: boolean;
  defaultHours: number;
  moduleCount: number;
}

/** Daftar posisi aktif + kursus yang sudah dipetakan ke masing-masing. */
export async function listPositionsWithCourses(db: Db): Promise<PositionWithCourses[]> {
  const res = (await db.execute(sql`
    SELECT p.id::text AS "positionId", p.position_title AS "title",
           d.department_name AS "departmentName",
           COUNT(pc.course_id)::int AS "mappedCount"
      FROM job_positions p
      LEFT JOIN departments d ON d.id = p.department_id
      LEFT JOIN position_courses pc ON pc.position_id = p.id
     GROUP BY p.id, p.position_title, d.department_name
     ORDER BY p.position_title
  `)) as unknown as { rows: Array<{ positionId: string; title: string; departmentName: string | null; mappedCount: unknown }> };

  const positions = (res.rows ?? []).map((r) => ({ ...r, mappedCount: Number(r.mappedCount) }));
  const out: PositionWithCourses[] = [];
  for (const p of positions) {
    out.push({ ...p, courses: await listPositionCourses(db, p.positionId) });
  }
  return out;
}

/** Katalog kursus aktif (untuk dipilih HR saat memetakan). */
export async function listCourseOptions(db: Db): Promise<CourseOption[]> {
  const res = (await db.execute(sql`
    SELECT c.id AS "courseId", c.course_code AS "courseCode", c.title, c.category,
           c.target_phase::text AS "targetPhase", c.is_mandatory AS "isMandatoryDefault",
           c.default_hours::float8 AS "defaultHours",
           (SELECT COUNT(*) FROM course_modules m WHERE m.course_id = c.id)::int AS "moduleCount"
      FROM moodle_courses c
     WHERE c.is_active = TRUE
     ORDER BY c.category, c.title
  `)) as unknown as { rows: Array<CourseOption & { courseId: unknown; defaultHours: unknown; moduleCount: unknown }> };
  return (res.rows ?? []).map((r) => ({
    ...r,
    courseId: Number(r.courseId),
    defaultHours: Number(r.defaultHours),
    moduleCount: Number(r.moduleCount),
  }));
}

export interface AddMappingInput {
  positionId: string;
  courseId: number;
  isMandatory?: boolean;
  orderIndex?: number;
  note?: string | null;
}

export interface MappingResult {
  ok: boolean;
  reason?: string;
}

/**
 * Tambah/perbarui mapping posisi→kursus (idempoten). Bila mapping sudah ada,
 * perbarui flag wajib/urutan/catatan (upsert).
 */
export async function addPositionCourse(db: Db, input: AddMappingInput): Promise<MappingResult> {
  const { positionId, courseId } = input;
  const posOk = (await db.execute(sql`SELECT 1 FROM job_positions WHERE id = ${positionId}::uuid`)) as unknown as { rows: unknown[] };
  if (!posOk.rows?.length) return { ok: false, reason: 'Posisi tidak ditemukan.' };
  const courseOk = (await db.execute(sql`SELECT 1 FROM moodle_courses WHERE id = ${courseId} AND is_active = TRUE`)) as unknown as { rows: unknown[] };
  if (!courseOk.rows?.length) return { ok: false, reason: 'Kursus tidak ditemukan atau tidak aktif.' };

  let orderIndex = input.orderIndex;
  if (orderIndex === undefined || orderIndex === null) {
    const next = (await db.execute(sql`
      SELECT COALESCE(MAX(order_index), 0) + 1 AS "next" FROM position_courses WHERE position_id = ${positionId}::uuid
    `)) as unknown as { rows: Array<{ next: unknown }> };
    orderIndex = Number(next.rows[0]?.next ?? 1);
  }

  await db.execute(sql`
    INSERT INTO position_courses (position_id, course_id, is_mandatory, order_index, note)
    VALUES (${positionId}::uuid, ${courseId}, ${input.isMandatory ?? true}, ${orderIndex}, ${input.note ?? null})
    ON CONFLICT (position_id, course_id)
    DO UPDATE SET is_mandatory = EXCLUDED.is_mandatory, order_index = EXCLUDED.order_index, note = EXCLUDED.note
  `);
  return { ok: true };
}

/** Hapus mapping posisi→kursus. */
export async function removePositionCourse(db: Db, positionId: string, courseId: number): Promise<MappingResult> {
  const res = (await db.execute(sql`
    DELETE FROM position_courses WHERE position_id = ${positionId}::uuid AND course_id = ${courseId}
    RETURNING position_id
  `)) as unknown as { rows?: unknown[] };
  if (!res.rows?.length) return { ok: false, reason: 'Mapping tidak ditemukan.' };
  return { ok: true };
}

export interface UpdateMappingInput {
  positionId: string;
  courseId: number;
  isMandatory?: boolean;
  orderIndex?: number;
  note?: string | null;
}

/** Perbarui atribut mapping (tanpa mengubah relasi). */
export async function updatePositionCourse(db: Db, input: UpdateMappingInput): Promise<MappingResult> {
  const { positionId, courseId } = input;
  const res = (await db.execute(sql`
    UPDATE position_courses
       SET is_mandatory = COALESCE(${input.isMandatory ?? null}, is_mandatory),
           order_index  = COALESCE(${input.orderIndex ?? null}, order_index),
           note         = ${input.note ?? null}
     WHERE position_id = ${positionId}::uuid AND course_id = ${courseId}
    RETURNING position_id
  `)) as unknown as { rows?: unknown[] };
  if (!res.rows?.length) return { ok: false, reason: 'Mapping tidak ditemukan.' };
  return { ok: true };
}

export interface ManualModuleInput {
  title: string;
  contentType?: 'TEXT' | 'VIDEO' | 'PDF' | 'QUIZ';
  contentBody?: string | null;
  contentUrl?: string | null;
}

export interface CreateCourseInput {
  title: string;
  category?: string | null;
  description?: string | null;
  defaultHours?: number;
  isMandatory?: boolean;
  courseCode?: string | null;
  modules?: ManualModuleInput[];
}

export interface CreateCourseResult extends MappingResult {
  courseId?: number;
  courseCode?: string;
}

/**
 * Mengubah judul menjadi kode kursus unik ala slug: `MAN-<SLUG>` atau memakai
 * kode yang diberikan. Bila bentrok, tambah sufiks numerik.
 */
async function uniqueCourseCode(db: Db, title: string, desired?: string | null): Promise<string> {
  const base = (desired && desired.trim())
    ? desired.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '-').slice(0, 40)
    : 'MAN-' + title.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  let code = base || 'MAN-COURSE';
  for (let i = 2; i < 500; i += 1) {
    const dup = (await db.execute(sql`SELECT 1 FROM moodle_courses WHERE course_code = ${code}`)) as unknown as { rows: unknown[] };
    if (!dup.rows?.length) return code;
    code = `${base.slice(0, 40)}-${i}`;
  }
  return `${base.slice(0, 36)}-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Membuat kursus katalog manual (fase DURING, non-wajib secara default) + modul
 * opsional. Dipakai HR untuk menambah katalog kursus sendiri di pemetaan posisi.
 */
export async function createCourse(db: Db, input: CreateCourseInput): Promise<CreateCourseResult> {
  const title = (input.title ?? '').trim();
  if (!title) return { ok: false, reason: 'Judul kursus wajib diisi.' };
  const code = await uniqueCourseCode(db, title, input.courseCode);
  const hours = Number.isFinite(Number(input.defaultHours)) && Number(input.defaultHours) > 0 ? Number(input.defaultHours) : 0;

  const ins = (await db.execute(sql`
    INSERT INTO moodle_courses (course_code, title, category, description, target_phase, is_mandatory, default_hours, level_min)
    VALUES (${code}, ${title.slice(0, 255)}, ${input.category?.trim() || 'Umum'}, ${input.description?.trim() || null},
            'DURING'::course_phase_enum, ${input.isMandatory ?? false}, ${hours}, 1)
    RETURNING id
  `)) as unknown as { rows: Array<{ id: number }> };
  const courseId = Number(ins.rows[0].id);

  const modules = (input.modules ?? []).filter((m) => (m.title ?? '').trim());
  let order = 1;
  for (const m of modules) {
    const ct = m.contentType && ['TEXT', 'VIDEO', 'PDF', 'QUIZ'].includes(m.contentType) ? m.contentType : 'TEXT';
    await db.execute(sql`
      INSERT INTO course_modules (course_id, title, order_index, content_type, content_url, content_body, quiz_key)
      VALUES (${courseId}, ${m.title.trim().slice(0, 255)}, ${order}, ${ct}::content_type_enum,
              ${m.contentUrl?.trim() || null}, ${m.contentBody?.trim() || null}, NULL)
    `);
    order += 1;
  }
  return { ok: true, courseId, courseCode: code };
}
