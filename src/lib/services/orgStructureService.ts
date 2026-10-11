/**
 * Organization Structure Service — referensi organisasi (departemen & posisi).
 *
 * Melengkapi `manpowerPlanService` & `jobPostingService` yang hanya *membaca*
 * departemen/posisi. Di sini HR dapat menambah departemen baru dan posisi baru
 * secara self-service; hasilnya langsung tersedia di dropdown MPP dan lowongan
 * karena semuanya membaca tabel `departments` / `job_positions` yang sama.
 *
 * Driver-agnostic (Drizzle + PGlite); deteksi baris memakai RETURNING.
 */
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export interface DepartmentRow {
  id: string;
  name: string;
  division: string | null;
  companyId: string;
  company: string;
  positionCount: number;
}

export interface PositionRow {
  id: string;
  title: string;
  departmentId: string;
  department: string;
  jobGrade: string | null;
}

export type OrgResult = { ok: true; id: string } | { ok: false; reason: string };

export interface DepartmentInput {
  departmentName: string;
  divisionName?: string | null;
  /** Bila kosong, memakai perusahaan pertama yang tersedia. */
  companyId?: string | null;
}

export interface PositionInput {
  departmentId: string;
  positionTitle: string;
  jobGrade?: string | null;
  /** Kamus kompetensi opsional (disimpan sebagai JSONB). */
  competencyDictionary?: unknown;
}

/** Daftar departemen + jumlah posisi & nama perusahaan. */
export async function listDepartments(db: Db): Promise<DepartmentRow[]> {
  const res = (await db.execute(sql`
    SELECT d.id, d.department_name AS name, d.division_name AS division,
           d.company_id AS "companyId", c.company_name AS company,
           (SELECT COUNT(*) FROM job_positions jp WHERE jp.department_id = d.id)::int AS "positionCount"
      FROM departments d
      JOIN companies c ON c.id = d.company_id
     ORDER BY d.department_name
  `)) as unknown as { rows: any[] };

  return (res.rows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    division: r.division ?? null,
    companyId: r.companyId,
    company: r.company,
    positionCount: Number(r.positionCount) || 0,
  }));
}

/** Daftar posisi (opsional difilter per departemen). */
export async function listPositions(db: Db, departmentId?: string): Promise<PositionRow[]> {
  const filter = departmentId ? sql`WHERE jp.department_id = ${departmentId}::uuid` : sql``;
  const res = (await db.execute(sql`
    SELECT jp.id, jp.position_title AS title, jp.department_id AS "departmentId",
           d.department_name AS department, jp.job_grade AS "jobGrade"
      FROM job_positions jp
      JOIN departments d ON d.id = jp.department_id
      ${filter}
     ORDER BY d.department_name, jp.position_title
  `)) as unknown as { rows: any[] };

  return (res.rows ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    departmentId: r.departmentId,
    department: r.department,
    jobGrade: r.jobGrade ?? null,
  }));
}

/** Tambah departemen baru. Menolak nama duplikat dalam perusahaan yang sama. */
export async function createDepartment(db: Db, input: DepartmentInput): Promise<OrgResult> {
  const name = input.departmentName.trim();
  if (!name) return { ok: false, reason: 'Nama departemen wajib diisi.' };

  let companyId = input.companyId ?? null;
  if (!companyId) {
    const first = (await db.execute(sql`
      SELECT id FROM companies ORDER BY created_at NULLS FIRST, id LIMIT 1
    `)) as unknown as { rows: Array<{ id: string }> };
    companyId = first.rows?.[0]?.id ?? null;
  }
  if (!companyId) return { ok: false, reason: 'Belum ada perusahaan. Tambahkan perusahaan terlebih dahulu.' };

  const dup = (await db.execute(sql`
    SELECT id FROM departments
     WHERE company_id = ${companyId}::uuid AND lower(department_name) = lower(${name})
     LIMIT 1
  `)) as unknown as { rows: Array<{ id: string }> };
  if (dup.rows?.length) return { ok: false, reason: 'Departemen dengan nama ini sudah ada.' };

  const res = (await db.execute(sql`
    INSERT INTO departments (company_id, department_name, division_name)
    VALUES (${companyId}::uuid, ${name}, ${input.divisionName?.trim() || null})
    RETURNING id
  `)) as unknown as { rows: Array<{ id: string }> };
  const id = res.rows?.[0]?.id;
  if (!id) return { ok: false, reason: 'Gagal menyimpan departemen.' };
  return { ok: true, id };
}

/** Tambah posisi baru di dalam departemen. Menolak judul duplikat dalam departemen. */
export async function createPosition(db: Db, input: PositionInput): Promise<OrgResult> {
  const title = input.positionTitle.trim();
  if (!title) return { ok: false, reason: 'Nama posisi wajib diisi.' };

  const dept = (await db.execute(sql`
    SELECT id FROM departments WHERE id = ${input.departmentId}::uuid LIMIT 1
  `)) as unknown as { rows: Array<{ id: string }> };
  if (!dept.rows?.length) return { ok: false, reason: 'Departemen tidak ditemukan.' };

  const dup = (await db.execute(sql`
    SELECT id FROM job_positions
     WHERE department_id = ${input.departmentId}::uuid AND lower(position_title) = lower(${title})
     LIMIT 1
  `)) as unknown as { rows: Array<{ id: string }> };
  if (dup.rows?.length) return { ok: false, reason: 'Posisi dengan nama ini sudah ada di departemen tersebut.' };

  const dict = input.competencyDictionary == null ? null : JSON.stringify(input.competencyDictionary);
  const res = (await db.execute(sql`
    INSERT INTO job_positions (department_id, position_title, job_grade, competency_dictionary)
    VALUES (${input.departmentId}::uuid, ${title}, ${input.jobGrade?.trim() || null},
            ${dict}::jsonb)
    RETURNING id
  `)) as unknown as { rows: Array<{ id: string }> };
  const id = res.rows?.[0]?.id;
  if (!id) return { ok: false, reason: 'Gagal menyimpan posisi.' };
  return { ok: true, id };
}
