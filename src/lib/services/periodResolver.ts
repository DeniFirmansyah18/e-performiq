import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

/**
 * Menerjemahkan kode periode (mis. `2026-Q3`) menjadi `appraisal_periods.id`.
 *
 * - kode dikenal         -> id periode
 * - kode tidak dikenal   -> `null` (pemanggil menghasilkan data kosong, bukan
 *                           mencampur seluruh periode)
 * - kode tidak diberikan -> periode terbaru yang BENAR-BENAR punya baris
 *                           `individual_kpis`; bila belum ada sama sekali,
 *                           periode ACTIVE terbaru; `null` bila tabel kosong
 *
 * Bawaan "periode terbaru yang punya data" dipilih agar angka yang dibaca BOD
 * menggambarkan satu periode nyata, bukan campuran kuartal dan bukan kuartal
 * berjalan yang penilaiannya belum diisi (yang akan tampil sebagai 0%).
 */
export async function resolvePeriodId(db: Db, periodCode?: string): Promise<string | null> {
  if (periodCode) {
    const res = (await db.execute(sql`
      SELECT id FROM appraisal_periods WHERE period_code = ${periodCode} LIMIT 1
    `)) as unknown as { rows: Array<{ id: string }> };
    return res.rows?.[0]?.id ?? null;
  }

  const withData = (await db.execute(sql`
    SELECT ap.id
      FROM appraisal_periods ap
     WHERE EXISTS (SELECT 1 FROM individual_kpis ik WHERE ik.period_id = ap.id)
     ORDER BY ap.end_date DESC, ap.period_code DESC
     LIMIT 1
  `)) as unknown as { rows: Array<{ id: string }> };
  if (withData.rows?.[0]?.id) return withData.rows[0].id;

  const latestActive = (await db.execute(sql`
    SELECT id FROM appraisal_periods
     WHERE status = 'ACTIVE'
     ORDER BY end_date DESC, period_code DESC
     LIMIT 1
  `)) as unknown as { rows: Array<{ id: string }> };
  return latestActive.rows?.[0]?.id ?? null;
}
