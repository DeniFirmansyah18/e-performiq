import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

/**
 * Alur persetujuan MPP (Manpower Plan).
 *
 * HR mengajukan kebutuhan formasi untuk departemen + posisi tertentu, lalu BOD
 * memutuskan menyetujui atau menolak. MPP hasil pengajuan berstatus PENDING
 * sampai diputuskan; MPP lama (sebelum alur ini ada) tetap APPROVED agar
 * rekrutmen yang sedang berjalan tidak terblokir.
 */

export type MppStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** Galat aturan bisnis untuk pengajuan MPP. */
export class MppButuhAtasanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MppButuhAtasanError';
  }
}

/** Galat saat keputusan MPP tidak memenuhi aturan. */
export class MppBukanPengajuError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MppBukanPengajuError';
  }
}

export interface MppRingkas {
  id: string;
  departmentId: string;
  departmentName: string | null;
  positionId: string;
  positionTitle: string | null;
  fiscalYear: number;
  approvedQuota: number;
  allocatedBudget: number;
  hiredCount: number;
  status: MppStatus;
  managerId: string | null;
  managerName: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
}

const SELECT_MPP = sql`
  mp.id::text AS id, mp.department_id::text AS "departmentId",
  d.department_name AS "departmentName",
  mp.position_id::text AS "positionId", jp.position_title AS "positionTitle",
  mp.fiscal_year AS "fiscalYear", mp.approved_quota AS "approvedQuota",
  mp.allocated_budget::float8 AS "allocatedBudget", mp.hired_count AS "hiredCount",
  mp.status::text AS status, mp.manager_id::text AS "managerId",
  m.full_name AS "managerName",
  mp.submitted_at::text AS "submittedAt", mp.decided_at::text AS "decidedAt",
  mp.decision_note AS "decisionNote"
`;

const DARI = sql`
  FROM manpower_plans mp
  LEFT JOIN departments d ON d.id = mp.department_id
  LEFT JOIN job_positions jp ON jp.id = mp.position_id
  LEFT JOIN employees m ON m.id = mp.manager_id
`;

function keRingkas(r: any): MppRingkas {
  return {
    id: r.id,
    departmentId: r.departmentId,
    departmentName: r.departmentName ?? null,
    positionId: r.positionId,
    positionTitle: r.positionTitle ?? null,
    fiscalYear: Number(r.fiscalYear ?? 0),
    approvedQuota: Number(r.approvedQuota ?? 0),
    allocatedBudget: Number(r.allocatedBudget ?? 0),
    hiredCount: Number(r.hiredCount ?? 0),
    status: r.status as MppStatus,
    managerId: r.managerId ?? null,
    managerName: r.managerName ?? null,
    submittedAt: r.submittedAt ?? null,
    decidedAt: r.decidedAt ?? null,
    decisionNote: r.decisionNote ?? null,
  };
}

/**
 * Memastikan calon atasan langsung benar-benar People Manager aktif.
 *
 * Atasan langsung bertugas memantau pegawai di departemen yang ia pimpin,
 * sehingga hanya akun berperan PEOPLE_MANAGER yang boleh dipilih.
 */
async function pastikanPeopleManager(db: Db, managerId: string): Promise<void> {
  if (!managerId) {
    throw new MppButuhAtasanError('Atasan langsung (People Manager) wajib dipilih.');
  }
  const r = (await db.execute(sql`
    SELECT 1 FROM employees e
      JOIN users u ON u.employee_id = e.id
     WHERE e.id = ${managerId}::uuid
       AND u.role = 'PEOPLE_MANAGER'
       AND e.status IN ('PROBATION','PERMANENT','CONTRACT')
     LIMIT 1
  `)) as unknown as { rows: unknown[] };
  if ((r.rows?.length ?? 0) === 0) {
    throw new MppButuhAtasanError(
      'Atasan langsung harus People Manager yang terdaftar dan masih aktif.'
    );
  }
}

export interface AjukanMppInput {
  departmentId: string;
  positionId: string;
  fiscalYear: number;
  approvedQuota: number;
  allocatedBudget: number;
  managerId: string;
  userId: string;
}

/** HR mengajukan MPP baru; hasilnya berstatus PENDING menunggu keputusan BOD. */
export async function ajukanMpp(db: Db, input: AjukanMppInput): Promise<MppRingkas> {
  await pastikanPeopleManager(db, input.managerId);

  const res = (await db.execute(sql`
    INSERT INTO manpower_plans
      (department_id, position_id, fiscal_year, approved_quota, allocated_budget,
       manager_id, status, submitted_by, submitted_at)
    VALUES (
      ${input.departmentId}::uuid, ${input.positionId}::uuid, ${input.fiscalYear},
      ${input.approvedQuota}, ${input.allocatedBudget},
      ${input.managerId}::uuid, 'PENDING'::mpp_status_enum,
      ${input.userId}::uuid, CURRENT_TIMESTAMP
    )
    ON CONFLICT (department_id, position_id, fiscal_year)
    DO UPDATE SET
      approved_quota = EXCLUDED.approved_quota,
      allocated_budget = EXCLUDED.allocated_budget,
      manager_id = EXCLUDED.manager_id,
      status = 'PENDING'::mpp_status_enum,
      submitted_by = EXCLUDED.submitted_by,
      submitted_at = CURRENT_TIMESTAMP,
      decided_by = NULL, decided_at = NULL, decision_note = NULL
    RETURNING id::text AS id
  `)) as unknown as { rows: Array<{ id: string }> };

  return ambilMpp(db, res.rows[0].id);
}

/** Satu MPP lengkap. */
export async function ambilMpp(db: Db, id: string): Promise<MppRingkas> {
  const res = (await db.execute(sql`
    SELECT ${SELECT_MPP} ${DARI} WHERE mp.id = ${id}::uuid LIMIT 1
  `)) as unknown as { rows: any[] };
  return keRingkas(res.rows[0]);
}

/** Daftar pengajuan yang menunggu keputusan BOD. */
export async function daftarMppMenunggu(db: Db): Promise<MppRingkas[]> {
  const res = (await db.execute(sql`
    SELECT ${SELECT_MPP} ${DARI}
     WHERE mp.status = 'PENDING'::mpp_status_enum
     ORDER BY mp.submitted_at ASC NULLS LAST
  `)) as unknown as { rows: any[] };
  return (res.rows ?? []).map(keRingkas);
}

/** Semua MPP (dipakai halaman Manajemen MPP di sisi HR). */
export async function daftarSemuaMpp(db: Db): Promise<MppRingkas[]> {
  const res = (await db.execute(sql`
    SELECT ${SELECT_MPP} ${DARI}
     ORDER BY mp.submitted_at DESC NULLS LAST, mp.fiscal_year DESC
  `)) as unknown as { rows: any[] };
  return (res.rows ?? []).map(keRingkas);
}

/** Daftar People Manager aktif untuk pilihan atasan langsung. */
export async function daftarPeopleManager(
  db: Db
): Promise<Array<{ id: string; fullName: string; departmentName: string | null }>> {
  const res = (await db.execute(sql`
    SELECT e.id::text AS id, e.full_name AS "fullName",
           d.department_name AS "departmentName"
      FROM employees e
      JOIN users u ON u.employee_id = e.id
      LEFT JOIN departments d ON d.id = e.department_id
     WHERE u.role = 'PEOPLE_MANAGER'
       AND e.status IN ('PROBATION','PERMANENT','CONTRACT')
     ORDER BY e.full_name
  `)) as unknown as { rows: any[] };
  return (res.rows ?? []).map((r) => ({
    id: r.id,
    fullName: r.fullName,
    departmentName: r.departmentName ?? null,
  }));
}

export interface PutuskanMppInput {
  id: string;
  keputusan: 'APPROVED' | 'REJECTED';
  userId: string;
  catatan?: string;
}

/**
 * BOD memutuskan sebuah pengajuan MPP.
 *
 * Penolakan wajib disertai alasan agar HR tahu apa yang perlu diperbaiki, dan
 * MPP yang sudah diputuskan tidak dapat diputuskan ulang.
 */
export async function putuskanMpp(db: Db, input: PutuskanMppInput): Promise<MppRingkas> {
  if (input.keputusan === 'REJECTED' && !(input.catatan ?? '').trim()) {
    throw new MppBukanPengajuError('Penolakan MPP wajib menyertakan alasan.');
  }

  const res = (await db.execute(sql`
    UPDATE manpower_plans
       SET status = ${input.keputusan}::mpp_status_enum,
           decided_by = ${input.userId}::uuid,
           decided_at = CURRENT_TIMESTAMP,
           decision_note = ${input.catatan ?? null}
     WHERE id = ${input.id}::uuid
       AND status = 'PENDING'::mpp_status_enum
    RETURNING id::text AS id
  `)) as unknown as { rows: Array<{ id: string }> };

  if (!res.rows?.length) {
    throw new MppBukanPengajuError('Pengajuan MPP ini sudah diputuskan atau tidak ditemukan.');
  }
  return ambilMpp(db, input.id);
}
