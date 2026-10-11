/**
 * Manpower Plan Service — CRUD rencana formasi SDM (MPP): kuota & budget.
 *
 * Sumber tunggal yang dipakai form "Buat Lowongan" (via `getPostingReference`)
 * dan panel manajemen MPP. Menambah/mengubah MPP di sini langsung mengubah
 * pilihan MPP pada form lowongan karena keduanya membaca tabel yang sama.
 *
 * Driver-agnostic (Drizzle + PGlite). Deteksi baris terdampak memakai RETURNING
 * karena `rowCount` tidak andal pada PGlite.
 */
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export interface ManpowerPlanRow {
  id: string;
  departmentId: string;
  department: string;
  positionId: string;
  position: string;
  fiscalYear: number;
  approvedQuota: number;
  allocatedBudget: number;
  utilizedBudget: number;
  hiredCount: number;
  remainingQuota: number;
  budgetUtilizationPct: number;
}

export interface ManpowerPlanInput {
  departmentId: string;
  positionId: string;
  fiscalYear: number;
  approvedQuota: number;
  allocatedBudget: number;
  utilizedBudget?: number;
  hiredCount?: number;
}

export type PlanMutationResult =
  | { ok: true; id: string }
  | { ok: false; reason: string; notFound?: boolean };

export interface MppReference {
  departments: Array<{ id: string; name: string }>;
  positions: Array<{ id: string; title: string; departmentId: string }>;
}

/** Daftar MPP (opsional difilter per tahun fiskal), lengkap dengan nama & sisa kuota. */
export async function listManpowerPlans(db: Db, fiscalYear?: number): Promise<ManpowerPlanRow[]> {
  const yearFilter = fiscalYear ? sql`WHERE mp.fiscal_year = ${fiscalYear}` : sql``;
  const res = (await db.execute(sql`
    SELECT mp.id,
           mp.department_id AS "departmentId", d.department_name AS department,
           mp.position_id AS "positionId", p.position_title AS position,
           mp.fiscal_year AS "fiscalYear",
           mp.approved_quota AS "approvedQuota",
           mp.allocated_budget::float8 AS "allocatedBudget",
           mp.utilized_budget::float8 AS "utilizedBudget",
           mp.hired_count AS "hiredCount"
      FROM manpower_plans mp
      JOIN departments d ON d.id = mp.department_id
      JOIN job_positions p ON p.id = mp.position_id
      ${yearFilter}
     ORDER BY mp.fiscal_year DESC, d.department_name, p.position_title
  `)) as unknown as { rows: any[] };

  return (res.rows ?? []).map((r) => {
    const approvedQuota = Number(r.approvedQuota) || 0;
    const hiredCount = Number(r.hiredCount) || 0;
    const allocatedBudget = Number(r.allocatedBudget) || 0;
    const utilizedBudget = Number(r.utilizedBudget) || 0;
    return {
      id: r.id,
      departmentId: r.departmentId,
      department: r.department,
      positionId: r.positionId,
      position: r.position,
      fiscalYear: Number(r.fiscalYear) || 0,
      approvedQuota,
      allocatedBudget,
      utilizedBudget,
      hiredCount,
      remainingQuota: Math.max(0, approvedQuota - hiredCount),
      budgetUtilizationPct: allocatedBudget > 0 ? Math.round((utilizedBudget / allocatedBudget) * 100) : 0,
    };
  });
}

/** Data referensi untuk form MPP: departemen & posisi. */
export async function getMppReference(db: Db): Promise<MppReference> {
  const departments = (await db.execute(sql`
    SELECT id, department_name AS name FROM departments ORDER BY department_name
  `)) as unknown as { rows: MppReference['departments'] };

  const positions = (await db.execute(sql`
    SELECT id, position_title AS title, department_id AS "departmentId"
      FROM job_positions ORDER BY position_title
  `)) as unknown as { rows: MppReference['positions'] };

  return { departments: departments.rows ?? [], positions: positions.rows ?? [] };
}

/** Buat MPP baru. Menolak kombinasi (departemen, posisi, tahun) yang sudah ada. */
export async function createManpowerPlan(db: Db, input: ManpowerPlanInput): Promise<PlanMutationResult> {
  const dup = (await db.execute(sql`
    SELECT id FROM manpower_plans
     WHERE department_id = ${input.departmentId}::uuid
       AND position_id = ${input.positionId}::uuid
       AND fiscal_year = ${input.fiscalYear}
     LIMIT 1
  `)) as unknown as { rows: Array<{ id: string }> };
  if (dup.rows?.length) {
    return { ok: false, reason: 'MPP untuk posisi, departemen, dan tahun ini sudah ada. Silakan ubah entri yang ada.' };
  }

  const res = (await db.execute(sql`
    INSERT INTO manpower_plans
      (department_id, position_id, fiscal_year, approved_quota, allocated_budget, utilized_budget, hired_count)
    VALUES
      (${input.departmentId}::uuid, ${input.positionId}::uuid, ${input.fiscalYear},
       ${input.approvedQuota}, ${input.allocatedBudget}::numeric,
       ${input.utilizedBudget ?? 0}::numeric, ${input.hiredCount ?? 0})
    RETURNING id
  `)) as unknown as { rows: Array<{ id: string }> };
  const id = res.rows?.[0]?.id;
  if (!id) return { ok: false, reason: 'Gagal menyimpan MPP.' };
  return { ok: true, id };
}

/**
 * Ubah MPP (parsial). Hanya field yang dikirim yang berubah; sisanya tetap.
 */
export async function updateManpowerPlan(
  db: Db,
  id: string,
  input: Partial<ManpowerPlanInput>,
): Promise<PlanMutationResult> {
  const exists = (await db.execute(sql`
    SELECT id FROM manpower_plans WHERE id = ${id}::uuid LIMIT 1
  `)) as unknown as { rows: Array<{ id: string }> };
  if (!exists.rows?.length) return { ok: false, reason: 'MPP tidak ditemukan.', notFound: true };

  const res = (await db.execute(sql`
    UPDATE manpower_plans SET
      department_id     = COALESCE(${input.departmentId ?? null}::uuid, department_id),
      position_id       = COALESCE(${input.positionId ?? null}::uuid, position_id),
      fiscal_year       = COALESCE(${input.fiscalYear ?? null}, fiscal_year),
      approved_quota    = COALESCE(${input.approvedQuota ?? null}, approved_quota),
      allocated_budget  = COALESCE(${input.allocatedBudget ?? null}::numeric, allocated_budget),
      utilized_budget   = COALESCE(${input.utilizedBudget ?? null}::numeric, utilized_budget),
      hired_count       = COALESCE(${input.hiredCount ?? null}, hired_count)
    WHERE id = ${id}::uuid
    RETURNING id
  `)) as unknown as { rows: Array<{ id: string }> };

  if (!res.rows?.[0]) return { ok: false, reason: 'Gagal memperbarui MPP.' };
  return { ok: true, id };
}

/** Hapus MPP. Gagal bila masih dirujuk lowongan/permintaan rekrutmen (FK RESTRICT). */
export async function deleteManpowerPlan(db: Db, id: string): Promise<PlanMutationResult> {
  const refs = (await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM job_postings WHERE manpower_plan_id = ${id}::uuid) AS postings,
      (SELECT COUNT(*) FROM hiring_requisitions WHERE manpower_plan_id = ${id}::uuid) AS requisitions
  `)) as unknown as { rows: Array<{ postings: unknown; requisitions: unknown }> };
  const used = Number(refs.rows?.[0]?.postings) + Number(refs.rows?.[0]?.requisitions);
  if (used > 0) {
    return { ok: false, reason: 'MPP masih dipakai oleh lowongan/permintaan rekrutmen. Hapus atau alihkan rujukannya terlebih dahulu.' };
  }

  const res = (await db.execute(sql`
    DELETE FROM manpower_plans WHERE id = ${id}::uuid RETURNING id
  `)) as unknown as { rows: Array<{ id: string }> };
  if (!res.rows?.[0]) return { ok: false, reason: 'MPP tidak ditemukan.', notFound: true };
  return { ok: true, id };
}
