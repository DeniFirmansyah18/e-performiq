import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

/**
 * Profil tenaga kerja agregat untuk tab Overview Command Center HRD
 * (Narasi 3 pilar 3: total headcount, sebaran departemen, rasio gender/usia/
 * grade, capaian KPI, dan pemenuhan MPP).
 *
 * Semua angka dibaca dari tabel yang ada; tidak ada nilai contoh.
 */

export interface DistributionBucket {
  label: string;
  count: number;
  percentage: number;
}

export interface WorkforceProfile {
  headcount: {
    total: number;
    active: number;
    probation: number;
    pkwt: number;
    permanent: number;
  };
  byDepartment: DistributionBucket[];
  byGender: DistributionBucket[];
  byAgeBand: DistributionBucket[];
  byJobGrade: DistributionBucket[];
  kpiAchievement: {
    averagePercentage: number;
    belowTargetCount: number;
    totalKpi: number;
  };
  mppFulfillment: {
    quota: number;
    hired: number;
    percentage: number;
  };
}

/** Batas usia (tahun) untuk pengelompokan; label terakhir menampung sisa. */
const AGE_BANDS: Array<{ label: string; min: number; max: number | null }> = [
  { label: '< 25 tahun', min: 0, max: 25 },
  { label: '25-34 tahun', min: 25, max: 35 },
  { label: '35-44 tahun', min: 35, max: 45 },
  { label: '45-54 tahun', min: 45, max: 55 },
  { label: '>= 55 tahun', min: 55, max: null },
];

const UNKNOWN_LABEL = 'Tidak diketahui';

function toBuckets(
  rows: Array<{ label: string | null; count: number }>
): DistributionBucket[] {
  const total = rows.reduce((sum, r) => sum + Number(r.count), 0);
  return rows.map((r) => ({
    label: r.label ?? UNKNOWN_LABEL,
    count: Number(r.count),
    percentage: total > 0 ? Math.round((Number(r.count) / total) * 1000) / 10 : 0,
  }));
}

export async function getWorkforceProfile(db: Db): Promise<WorkforceProfile> {
  const headcountRes = (await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (
        WHERE status NOT IN ('RESIGNED', 'RETIRED')
          AND COALESCE(employment_status::text, '') NOT IN ('RESIGNED', 'RETIRED')
      )::int AS active,
      COUNT(*) FILTER (WHERE status = 'PROBATION')::int AS probation,
      COUNT(*) FILTER (WHERE employment_status = 'PKWT')::int AS pkwt,
      COUNT(*) FILTER (WHERE status = 'PERMANENT')::int AS permanent
    FROM employees
  `)) as unknown as {
    rows: Array<{
      total: number;
      active: number;
      probation: number;
      pkwt: number;
      permanent: number;
    }>;
  };
  const hc = headcountRes.rows?.[0];

  const deptRes = (await db.execute(sql`
    SELECT d.department_name AS label, COUNT(e.id)::int AS count
      FROM departments d
      LEFT JOIN employees e
        ON e.department_id = d.id
       AND e.status NOT IN ('RESIGNED', 'RETIRED')
     GROUP BY d.department_name
     ORDER BY count DESC, d.department_name ASC
  `)) as unknown as { rows: Array<{ label: string | null; count: number }> };

  const genderRes = (await db.execute(sql`
    SELECT COALESCE(NULLIF(TRIM(e.gender), ''), '${sql.raw(UNKNOWN_LABEL)}') AS label,
           COUNT(*)::int AS count
      FROM employees e
     WHERE e.status NOT IN ('RESIGNED', 'RETIRED')
     GROUP BY 1
     ORDER BY count DESC
  `)) as unknown as { rows: Array<{ label: string | null; count: number }> };

  const ageRes = (await db.execute(sql`
    SELECT
      CASE
        WHEN e.date_of_birth IS NULL THEN '${sql.raw(UNKNOWN_LABEL)}'
        WHEN EXTRACT(YEAR FROM age(CURRENT_DATE, e.date_of_birth)) < 25 THEN '< 25 tahun'
        WHEN EXTRACT(YEAR FROM age(CURRENT_DATE, e.date_of_birth)) < 35 THEN '25-34 tahun'
        WHEN EXTRACT(YEAR FROM age(CURRENT_DATE, e.date_of_birth)) < 45 THEN '35-44 tahun'
        WHEN EXTRACT(YEAR FROM age(CURRENT_DATE, e.date_of_birth)) < 55 THEN '45-54 tahun'
        ELSE '>= 55 tahun'
      END AS label,
      COUNT(*)::int AS count
    FROM employees e
    WHERE e.status NOT IN ('RESIGNED', 'RETIRED')
    GROUP BY 1
  `)) as unknown as { rows: Array<{ label: string | null; count: number }> };

  const gradeRes = (await db.execute(sql`
    SELECT COALESCE(NULLIF(TRIM(jp.job_grade), ''), '${sql.raw(UNKNOWN_LABEL)}') AS label,
           COUNT(*)::int AS count
      FROM employees e
      LEFT JOIN job_positions jp ON jp.id = e.position_id
     WHERE e.status NOT IN ('RESIGNED', 'RETIRED')
     GROUP BY 1
     ORDER BY 1
  `)) as unknown as { rows: Array<{ label: string | null; count: number }> };

  const kpiRes = (await db.execute(sql`
    SELECT
      COALESCE(AVG(achievement_percentage), 0)::float8 AS avg_pct,
      COUNT(*) FILTER (WHERE achievement_percentage < 100)::int AS below_target,
      COUNT(*)::int AS total
    FROM individual_kpis
  `)) as unknown as {
    rows: Array<{ avg_pct: number; below_target: number; total: number }>;
  };
  const kpi = kpiRes.rows?.[0];

  const mppRes = (await db.execute(sql`
    SELECT COALESCE(SUM(approved_quota), 0)::int AS quota,
           COALESCE(SUM(hired_count), 0)::int AS hired
      FROM manpower_plans
  `)) as unknown as { rows: Array<{ quota: number; hired: number }> };
  const mpp = mppRes.rows?.[0];
  const quota = Number(mpp?.quota ?? 0);
  const hired = Number(mpp?.hired ?? 0);

  // Urutkan pita usia sesuai definisi, bukan alfabetis.
  const ageBuckets = toBuckets(ageRes.rows ?? []);
  const ageOrder = [...AGE_BANDS.map((b) => b.label), UNKNOWN_LABEL];
  ageBuckets.sort(
    (a, b) => ageOrder.indexOf(a.label) - ageOrder.indexOf(b.label)
  );

  return {
    headcount: {
      total: Number(hc?.total ?? 0),
      active: Number(hc?.active ?? 0),
      probation: Number(hc?.probation ?? 0),
      pkwt: Number(hc?.pkwt ?? 0),
      permanent: Number(hc?.permanent ?? 0),
    },
    byDepartment: toBuckets(deptRes.rows ?? []).filter((b) => b.count > 0),
    byGender: toBuckets(genderRes.rows ?? []),
    byAgeBand: ageBuckets,
    byJobGrade: toBuckets(gradeRes.rows ?? []),
    kpiAchievement: {
      averagePercentage: Math.round(Number(kpi?.avg_pct ?? 0) * 10) / 10,
      belowTargetCount: Number(kpi?.below_target ?? 0),
      totalKpi: Number(kpi?.total ?? 0),
    },
    mppFulfillment: {
      quota,
      hired,
      percentage: quota > 0 ? Math.round((hired / quota) * 1000) / 10 : 0,
    },
  };
}