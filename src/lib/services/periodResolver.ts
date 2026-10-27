import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

/**
 * Menerjemahkan kode periode (mis. `2026-Q3`) menjadi `appraisal_periods.id`.
 *
 * - kode dikenal         -> id periode tersebut
 * - kode tidak dikenal   -> `null` (pemanggil menghasilkan data kosong, bukan
 *                           mencampur seluruh periode)
 * - kode tidak diberikan -> periode terbaru yang punya capaian TEREKAM
 *                           (`actual_value > 0`); bila belum ada, periode
 *                           terbaru yang punya baris KPI; bila belum ada juga,
 *                           periode ACTIVE terbaru; `null` bila tabel kosong
 *
 * Bawaan ini dipilih agar angka BOD menggambarkan satu periode nyata yang
 * penilaiannya sudah diisi, bukan campuran kuartal dan bukan kuartal berjalan
 * yang seluruh aktualnya masih 0 (yang akan tampil sebagai 0% di semua pilar).
 */
export async function resolvePeriodId(db: Db, periodCode?: string): Promise<string | null> {
  if (periodCode) {
    const res = (await db.execute(sql`
      SELECT id FROM appraisal_periods WHERE period_code = ${periodCode} LIMIT 1
    `)) as unknown as { rows: Array<{ id: string }> };
    return res.rows?.[0]?.id ?? null;
  }

  const withAchievement = (await db.execute(sql`
    SELECT ap.id
      FROM appraisal_periods ap
     WHERE EXISTS (
             SELECT 1 FROM individual_kpis ik
              WHERE ik.period_id = ap.id AND ik.actual_value > 0
           )
     ORDER BY ap.end_date DESC, ap.period_code DESC
     LIMIT 1
  `)) as unknown as { rows: Array<{ id: string }> };
  if (withAchievement.rows?.[0]?.id) return withAchievement.rows[0].id;

  const withRows = (await db.execute(sql`
    SELECT ap.id
      FROM appraisal_periods ap
     WHERE EXISTS (SELECT 1 FROM individual_kpis ik WHERE ik.period_id = ap.id)
     ORDER BY ap.end_date DESC, ap.period_code DESC
     LIMIT 1
  `)) as unknown as { rows: Array<{ id: string }> };
  if (withRows.rows?.[0]?.id) return withRows.rows[0].id;

  const latestActive = (await db.execute(sql`
    SELECT id FROM appraisal_periods
     WHERE status = 'ACTIVE'
     ORDER BY end_date DESC, period_code DESC
     LIMIT 1
  `)) as unknown as { rows: Array<{ id: string }> };
  return latestActive.rows?.[0]?.id ?? null;
}

/** Kode periode dari sebuah id, untuk dilaporkan kembali ke pemanggil. */
export async function periodCodeOf(db: Db, periodId: string | null): Promise<string | null> {
  if (!periodId) return null;
  const res = (await db.execute(sql`
    SELECT period_code FROM appraisal_periods WHERE id = ${periodId}::uuid LIMIT 1
  `)) as unknown as { rows: Array<{ period_code: string }> };
  return res.rows?.[0]?.period_code ?? null;
}
