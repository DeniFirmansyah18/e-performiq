/**
 * Job Posting Service (WS-12) — CRUD lowongan kerja oleh HR + detail kualifikasi.
 *
 * Menyediakan:
 *  - `listHrPostings()`  : semua lowongan (semua status) + kuota/terisi/sisa dari MPP.
 *  - `getPostingReference()` : departemen, posisi, MPP (untuk form).
 *  - `createPosting()` / `updatePosting()` / `setPostingStatus()` : kelola lowongan.
 *
 * Kuota bersumber dari `manpower_plans.approved_quota` (via `manpower_plan_id`).
 * Deterministik, driver-agnostic, best-effort.
 */
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export type PostingStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'FILLED';

export interface HrPosting {
  id: string;
  postingTitle: string;
  description: string;
  requiredSkills: string[];
  departmentId: string;
  department: string;
  positionId: string;
  position: string;
  manpowerPlanId: string;
  status: PostingStatus;
  isPublic: boolean;
  minEducation: string | null;
  minExperienceYears: number | null;
  workLocation: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  employmentType: string | null;
  quota: number;
  hired: number;
  remaining: number;
  availability: 'AVAILABLE' | 'FILLED' | 'CLOSED';
  postedAt: string | null;
}

function parseSkills(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p.map(String) : []; } catch { return []; } }
  return [];
}

/** Daftar seluruh lowongan (semua status) dengan kuota real-time. */
export async function listHrPostings(db: Db): Promise<HrPosting[]> {
  const res = (await db.execute(sql`
    SELECT jp.id, jp.posting_title AS "postingTitle", jp.description, jp.required_skills AS "requiredSkills",
           jp.department_id AS "departmentId", d.department_name AS "department",
           jp.position_id AS "positionId", p.position_title AS "position",
           jp.manpower_plan_id AS "manpowerPlanId",
           jp.status, jp.is_public AS "isPublic", jp.posted_at AS "postedAt",
           jp.min_education AS "minEducation", jp.min_experience_years::float8 AS "minExperienceYears",
           jp.work_location AS "workLocation", jp.salary_min::float8 AS "salaryMin",
           jp.salary_max::float8 AS "salaryMax", jp.employment_type AS "employmentType",
           COALESCE(mp.approved_quota, 0) AS "quota",
           COALESCE(mp.hired_count, 0) + COALESCE(hired.accepted, 0) AS "hired"
      FROM job_postings jp
      JOIN departments d ON d.id = jp.department_id
      JOIN job_positions p ON p.id = jp.position_id
      LEFT JOIN manpower_plans mp ON mp.id = jp.manpower_plan_id
      LEFT JOIN (
        SELECT job_posting_id, COUNT(*) FILTER (WHERE status IN ('HIRED','OFFERED')) AS accepted
          FROM job_applications GROUP BY job_posting_id
      ) hired ON hired.job_posting_id = jp.id
     ORDER BY (jp.status = 'OPEN') DESC, jp.posted_at DESC
  `)) as unknown as { rows: any[] };

  return (res.rows ?? []).map((r) => {
    const quota = Number(r.quota) || 0;
    const hired = Number(r.hired) || 0;
    const remaining = Math.max(0, quota - hired);
    let availability: HrPosting['availability'] = 'AVAILABLE';
    if (r.status === 'CLOSED') availability = 'CLOSED';
    else if (r.status === 'FILLED' || (quota > 0 && remaining <= 0)) availability = 'FILLED';
    return {
      id: r.id,
      postingTitle: r.postingTitle,
      description: r.description,
      requiredSkills: parseSkills(r.requiredSkills),
      departmentId: r.departmentId,
      department: r.department,
      positionId: r.positionId,
      position: r.position,
      manpowerPlanId: r.manpowerPlanId,
      status: r.status,
      isPublic: !!r.isPublic,
      minEducation: r.minEducation ?? null,
      minExperienceYears: r.minExperienceYears != null ? Number(r.minExperienceYears) : null,
      workLocation: r.workLocation ?? null,
      salaryMin: r.salaryMin != null ? Number(r.salaryMin) : null,
      salaryMax: r.salaryMax != null ? Number(r.salaryMax) : null,
      employmentType: r.employmentType ?? null,
      quota, hired, remaining, availability,
      postedAt: r.postedAt ?? null,
    };
  });
}

/** Data referensi untuk form HR: departemen, posisi, MPP (dengan kuota & posisi). */
export async function getPostingReference(db: Db) {
  const departments = (await db.execute(sql`
    SELECT id, department_name AS name FROM departments ORDER BY department_name
  `)) as unknown as { rows: Array<{ id: string; name: string }> };

  const positions = (await db.execute(sql`
    SELECT id, position_title AS title, department_id AS "departmentId"
      FROM job_positions ORDER BY position_title
  `)) as unknown as { rows: Array<{ id: string; title: string; departmentId: string }> };

  const mpps = (await db.execute(sql`
    SELECT mp.id, mp.fiscal_year AS "fiscalYear", mp.approved_quota AS "approvedQuota",
           mp.hired_count AS "hiredCount", mp.allocated_budget::float8 AS "allocatedBudget",
           d.department_name AS department, p.position_title AS position,
           mp.department_id AS "departmentId", mp.position_id AS "positionId"
      FROM manpower_plans mp
      JOIN departments d ON d.id = mp.department_id
      JOIN job_positions p ON p.id = mp.position_id
     ORDER BY mp.fiscal_year DESC, d.department_name
  `)) as unknown as { rows: any[] };

  return { departments: departments.rows ?? [], positions: positions.rows ?? [], mpps: mpps.rows ?? [] };
}

export interface PostingInput {
  postingTitle: string;
  description: string;
  requiredSkills: string[];
  departmentId: string;
  positionId: string;
  manpowerPlanId: string;
  status?: PostingStatus;
  isPublic?: boolean;
  minEducation?: string | null;
  minExperienceYears?: number | null;
  workLocation?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  employmentType?: string | null;
}

/** Buat lowongan baru (HR). */
export async function createPosting(db: Db, input: PostingInput): Promise<{ id: string }> {
  const res = (await db.execute(sql`
    INSERT INTO job_postings
      (posting_title, description, required_skills, department_id, position_id, manpower_plan_id,
       status, is_public, is_internal_only, min_education, min_experience_years, work_location,
       salary_min, salary_max, employment_type)
    VALUES
      (${input.postingTitle}, ${input.description}, ${JSON.stringify(input.requiredSkills ?? [])}::jsonb,
       ${input.departmentId}::uuid, ${input.positionId}::uuid, ${input.manpowerPlanId}::uuid,
       ${input.status ?? 'DRAFT'}, ${input.isPublic ?? false}, ${!(input.isPublic ?? false)},
       ${input.minEducation ?? null}, ${input.minExperienceYears ?? null}, ${input.workLocation ?? null},
       ${input.salaryMin ?? null}, ${input.salaryMax ?? null}, ${input.employmentType ?? 'PERMANENT'})
    RETURNING id
  `)) as unknown as { rows: Array<{ id: string }> };
  return res.rows[0];
}

/** Ubah lowongan (HR). */
export async function updatePosting(db: Db, id: string, input: PostingInput): Promise<boolean> {
  const res = (await db.execute(sql`
    UPDATE job_postings SET
      posting_title = ${input.postingTitle}, description = ${input.description},
      required_skills = ${JSON.stringify(input.requiredSkills ?? [])}::jsonb,
      department_id = ${input.departmentId}::uuid, position_id = ${input.positionId}::uuid,
      manpower_plan_id = ${input.manpowerPlanId}::uuid,
      status = ${input.status ?? 'DRAFT'}, is_public = ${input.isPublic ?? false},
      is_internal_only = ${!(input.isPublic ?? false)},
      min_education = ${input.minEducation ?? null}, min_experience_years = ${input.minExperienceYears ?? null},
      work_location = ${input.workLocation ?? null}, salary_min = ${input.salaryMin ?? null},
      salary_max = ${input.salaryMax ?? null}, employment_type = ${input.employmentType ?? 'PERMANENT'}
    WHERE id = ${id}::uuid
    RETURNING id
  `)) as unknown as { rows: Array<{ id: string }> };
  return !!res.rows[0];
}

/**
 * Ubah status / publikasi lowongan (HR) — mis. buka, tutup, tandai terisi.
 * `closed_at` diisi saat CLOSED/FILLED.
 */
export async function setPostingStatus(
  db: Db,
  id: string,
  status: PostingStatus,
  isPublic?: boolean,
): Promise<boolean> {
  const res = (await db.execute(sql`
    UPDATE job_postings SET
      status = ${status},
      is_public = COALESCE(${isPublic ?? null}, is_public),
      closed_at = CASE WHEN ${status} IN ('CLOSED','FILLED') THEN CURRENT_TIMESTAMP ELSE NULL END
    WHERE id = ${id}::uuid
    RETURNING id
  `)) as unknown as { rows: Array<{ id: string }> };
  return !!res.rows[0];
}

/**
 * Otomatis tandai lowongan FILLED bila kuota terisi penuh (dipakai setelah
 * lamaran berstatus HIRED/ACCEPTED). Best-effort.
 */
export async function autoFillPostings(db: Db): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE job_postings jp SET status = 'FILLED', closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP)
      WHERE jp.status = 'OPEN' AND jp.manpower_plan_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM manpower_plans mp WHERE mp.id = jp.manpower_plan_id
            AND mp.approved_quota > 0
            AND (mp.hired_count + COALESCE((
              SELECT COUNT(*) FROM job_applications ja
               WHERE ja.job_posting_id = jp.id AND ja.status IN ('HIRED','OFFERED')
            ), 0)) >= mp.approved_quota
        )
    `);
  } catch {
    /* best-effort */
  }
}
