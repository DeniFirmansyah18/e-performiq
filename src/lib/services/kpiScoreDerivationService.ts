import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export interface DerivedKpiScore {
  /** Skor KPI 0-100 berbobot; `null` bila belum ada capaian yang bisa dihitung. */
  value: number | null;
  detail: {
    kpiCount: number;
    evaluated: number;
    totalWeight: number;
    /** Rincian per KPI agar angka bisa diaudit di UI. */
    items: Array<{
      kpiId: string;
      kpiTitle: string;
      weight: number;
      target: number;
      actual: number;
      ratio: number;
    }>;
  };
}

/**
 * Menurunkan skor KPI dari data `individual_kpis` (PRD §3: skor KPI = rata-rata
 * berbobot capaian/target). Dipakai agar Composite GPA benar-benar berasal dari
 * KPI yang diinput karyawan, bukan angka yang diketik ulang di formulir.
 *
 * KPI tanpa capaian (actual_value 0 dan belum pernah diisi) tetap dihitung
 * sebagai 0% agar bobot tetap 100% dan tidak menggelembungkan skor.
 */
export async function deriveKpiScore(
  db: Db,
  employeeId: string,
  periodId: string,
): Promise<DerivedKpiScore> {
  const res = (await db.execute(sql`
    SELECT k.id, k.kpi_title AS "kpiTitle", k.kpi_weight::float8 AS "weight",
           k.target_value::float8 AS "target", k.actual_value::float8 AS "actual",
           COALESCE(
             (SELECT bool_and(i.direction = 'LOWER_BETTER')
                FROM kpi_indicators i
               WHERE i.kpi_id = k.id AND i.is_active = TRUE),
             FALSE
           ) AS "lowerBetter"
      FROM individual_kpis k
     WHERE k.employee_id = ${employeeId}::uuid
       AND k.period_id = ${periodId}::uuid
     ORDER BY k.created_at ASC
  `)) as unknown as {
    rows: Array<{
      id: string;
      kpiTitle: string;
      weight: number;
      target: number;
      actual: number;
      lowerBetter: boolean;
    }>;
  };

  const rows = res.rows ?? [];
  const items = rows.map((r) => {
    const weight = Number(r.weight) || 0;
    const target = Number(r.target) || 0;
    const actual = Number(r.actual) || 0;
    let ratio = 0;
    if (target > 0) {
      ratio = r.lowerBetter
        ? Number((target / Math.max(actual, 0.01)).toFixed(4))
        : Number((actual / target).toFixed(4));
    }
    return { kpiId: r.id, kpiTitle: r.kpiTitle, weight, target, actual, ratio };
  });

  const evaluated = items.filter((i) => i.weight > 0 && i.target > 0);
  const totalWeight = evaluated.reduce((sum, i) => sum + i.weight, 0);

  if (!evaluated.length || totalWeight === 0) {
    return { value: null, detail: { kpiCount: rows.length, evaluated: 0, totalWeight: 0, items } };
  }

  const weightedRatio = evaluated.reduce((sum, i) => sum + i.weight * i.ratio, 0);
  // Skor KPI dibatasi 0-100: capaian di atas target tidak boleh melampaui 100
  // (kolom kpi_composite_score hanya menerima 0-100 dan skor tidak "menutupi" gap lain).
  const raw = (weightedRatio / totalWeight) * 100;
  const value = Number(Math.min(100, Math.max(0, raw)).toFixed(2));

  return {
    value,
    detail: { kpiCount: rows.length, evaluated: evaluated.length, totalWeight, items },
  };
}
