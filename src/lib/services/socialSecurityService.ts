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
