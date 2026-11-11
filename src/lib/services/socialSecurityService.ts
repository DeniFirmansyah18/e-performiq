import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError } from '@/lib/auth/errors';
import { logAction } from './auditService';

export interface SocialSecurityMasked {
  bpjsTkNumber: string | null;
  bpjsKesNumber: string | null;
  bpjsKesClass: string | null;
  bpjsTkStatus: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  bpjsKesStatus: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  registeredAt: string | null;
}

/** Menyembunyikan semua digit kecuali 4 terakhir; aman untuk nilai pendek/null. */
export function maskNumber(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\s+/g, '');
  if (digits.length <= 4) return '•'.repeat(digits.length);
  return '•'.repeat(digits.length - 4) + digits.slice(-4);
}

export async function getSocialSecurity(db: Db, employeeId: string): Promise<SocialSecurityMasked | null> {
  const res = (await db.execute(sql`
    SELECT bpjs_tk_number AS "bpjsTkNumber", bpjs_kes_number AS "bpjsKesNumber",
           bpjs_kes_class AS "bpjsKesClass", bpjs_tk_status AS "bpjsTkStatus",
           bpjs_kes_status AS "bpjsKesStatus", registered_at AS "registeredAt"
      FROM employee_social_security WHERE employee_id = ${employeeId}::uuid
  `)) as unknown as { rows: SocialSecurityMasked[] };

  const row = res.rows?.[0];
  if (!row) return null;

  return {
    ...row,
    bpjsTkNumber: maskNumber(row.bpjsTkNumber),
    bpjsKesNumber: maskNumber(row.bpjsKesNumber),
  };
}

export async function revealSocialSecurity(
  db: Db,
  input: { employeeId: string; userId: string; reason: string },
): Promise<{ bpjsTkNumber: string | null; bpjsKesNumber: string | null }> {
  if (!input.reason || input.reason.trim().length < 5) {
    throw new BusinessRuleError('Alasan membuka data wajib diisi (minimal 5 karakter).');
  }

  const res = (await db.execute(sql`
    SELECT bpjs_tk_number AS "bpjsTkNumber", bpjs_kes_number AS "bpjsKesNumber"
      FROM employee_social_security WHERE employee_id = ${input.employeeId}::uuid
  `)) as unknown as { rows: Array<{ bpjsTkNumber: string | null; bpjsKesNumber: string | null }> };

  const row = res.rows?.[0];
  if (!row) throw new BusinessRuleError('Data BPJS belum terdaftar.');

  await logAction(db, {
    userId: input.userId,
    actionType: 'UPDATE',
    entityName: 'employee_social_security',
    recordId: input.employeeId,
    description: `Membuka nomor BPJS penuh. Alasan: ${input.reason}`,
  });

  return row;
}

/* ------------------------------------------------------------------ */
/* Panel HR                                                            */
/* ------------------------------------------------------------------ */

export interface HrSocialSecurityRow {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentId?: string | null;
  departmentName?: string | null;
  bpjsTkNumber: string | null;
  bpjsKesNumber: string | null;
  bpjsKesClass: string | null;
  bpjsTkStatus: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  bpjsKesStatus: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  registeredAt: string | null;
  /** false = karyawan belum punya baris BPJS sama sekali. */
  registered: boolean;
}

/** Daftar peserta BPJS seluruh karyawan aktif, nomor selalu ter-masking. */
export async function listSocialSecurityForHr(
  db: Db,
  opts: { missingOnly?: boolean; departmentId?: string } = {},
): Promise<HrSocialSecurityRow[]> {
  const deptFilter = opts.departmentId
    ? sql`AND e.department_id = ${opts.departmentId}::uuid`
    : sql``;

  const res = (await db.execute(sql`
    SELECT e.id AS "employeeId", e.employee_code AS "employeeCode", e.full_name AS "employeeName",
           e.department_id::text AS "departmentId", d.department_name AS "departmentName",
           s.bpjs_tk_number AS "bpjsTkNumber", s.bpjs_kes_number AS "bpjsKesNumber",
           s.bpjs_kes_class AS "bpjsKesClass",
           COALESCE(s.bpjs_tk_status, 'PENDING') AS "bpjsTkStatus",
           COALESCE(s.bpjs_kes_status, 'PENDING') AS "bpjsKesStatus",
           s.registered_at AS "registeredAt",
           (s.employee_id IS NOT NULL) AS registered
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN employee_social_security s ON s.employee_id = e.id
     WHERE e.status <> 'RESIGNED'
       AND (${Boolean(opts.missingOnly)} = FALSE OR s.employee_id IS NULL)
       ${deptFilter}
     ORDER BY e.full_name
  `)) as unknown as { rows: HrSocialSecurityRow[] };

  return (res.rows ?? []).map((r) => ({
    ...r,
    bpjsTkNumber: maskNumber(r.bpjsTkNumber),
    bpjsKesNumber: maskNumber(r.bpjsKesNumber),
  }));
}

const NUMBER_RE = /^\d{8,20}$/;

/** HR membuat/memperbarui data peserta. Nomor divalidasi angka 8–20 digit. */
export async function upsertSocialSecurity(
  db: Db,
  input: {
    employeeId: string;
    bpjsTkNumber?: string | null;
    bpjsKesNumber?: string | null;
    bpjsKesClass?: string | null;
    bpjsTkStatus?: 'ACTIVE' | 'INACTIVE' | 'PENDING';
    bpjsKesStatus?: 'ACTIVE' | 'INACTIVE' | 'PENDING';
    registeredAt?: string | null;
    actorId?: string;
  },
): Promise<SocialSecurityMasked> {
  for (const [label, value] of [
    ['BPJS Ketenagakerjaan', input.bpjsTkNumber],
    ['BPJS Kesehatan', input.bpjsKesNumber],
  ] as const) {
    if (value !== undefined && value !== null && value !== '' && !NUMBER_RE.test(value)) {
      throw new BusinessRuleError(`Nomor ${label} harus 8–20 digit angka.`);
    }
  }

  const exists = (await db.execute(sql`
    SELECT 1 FROM employees WHERE id = ${input.employeeId}::uuid
  `)) as unknown as { rows: unknown[] };
  if (!exists.rows?.length) throw new BusinessRuleError('Karyawan tidak ditemukan.');

  const res = (await db.execute(sql`
    INSERT INTO employee_social_security
      (employee_id, bpjs_tk_number, bpjs_kes_number, bpjs_kes_class,
       bpjs_tk_status, bpjs_kes_status, registered_at)
    VALUES (${input.employeeId}::uuid,
            ${input.bpjsTkNumber || null}, ${input.bpjsKesNumber || null}, ${input.bpjsKesClass || null},
            ${input.bpjsTkStatus ?? 'ACTIVE'}, ${input.bpjsKesStatus ?? 'ACTIVE'},
            ${input.registeredAt ?? null}::date)
    ON CONFLICT (employee_id) DO UPDATE
      SET bpjs_tk_number = COALESCE(EXCLUDED.bpjs_tk_number, employee_social_security.bpjs_tk_number),
          bpjs_kes_number = COALESCE(EXCLUDED.bpjs_kes_number, employee_social_security.bpjs_kes_number),
          bpjs_kes_class = COALESCE(EXCLUDED.bpjs_kes_class, employee_social_security.bpjs_kes_class),
          bpjs_tk_status = EXCLUDED.bpjs_tk_status,
          bpjs_kes_status = EXCLUDED.bpjs_kes_status,
          registered_at = COALESCE(EXCLUDED.registered_at, employee_social_security.registered_at),
          updated_at = CURRENT_TIMESTAMP
    RETURNING bpjs_tk_number AS "bpjsTkNumber", bpjs_kes_number AS "bpjsKesNumber",
              bpjs_kes_class AS "bpjsKesClass", bpjs_tk_status AS "bpjsTkStatus",
              bpjs_kes_status AS "bpjsKesStatus", registered_at AS "registeredAt"
  `)) as unknown as { rows: SocialSecurityMasked[] };

  // Jejak audit sengaja hanya mencatat BIDANG yang berubah, bukan nomornya.
  await logAction(db, {
    userId: input.actorId ?? null,
    actionType: 'UPDATE',
    entityName: 'employee_social_security',
    recordId: input.employeeId,
    newData: {
      fields: Object.entries({
        bpjsTkNumber: input.bpjsTkNumber,
        bpjsKesNumber: input.bpjsKesNumber,
        bpjsKesClass: input.bpjsKesClass,
        bpjsTkStatus: input.bpjsTkStatus,
        bpjsKesStatus: input.bpjsKesStatus,
        registeredAt: input.registeredAt,
      }).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k]) => k),
    },
    description: 'Memperbarui data peserta BPJS (nomor tidak dicatat)',
  });

  const row = res.rows[0];
  return {
    ...row,
    bpjsTkNumber: maskNumber(row.bpjsTkNumber),
    bpjsKesNumber: maskNumber(row.bpjsKesNumber),
  };
}
