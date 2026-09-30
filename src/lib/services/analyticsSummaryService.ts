import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

/**
 * Analytics summaries (WS-1 Task 7).
 * Nilai benchmark industri dibaca dari tabel `industry_benchmarks` (seeded),
 * bukan konstanta di route. Semua agregat null-safe (0 bila data kosong).
 */

async function readBenchmarks(db: Db): Promise<Record<string, number>> {
  const res = (await db.execute(sql`
    SELECT metric_code AS "code", benchmark_value AS "value" FROM industry_benchmarks
  `)) as unknown as { rows: Array<{ code: string; value: string | number }> };
  const map: Record<string, number> = {};
  for (const row of res.rows ?? []) map[row.code] = Number(row.value);
  return map;
}

export interface BenchmarkMetric {
  code: string;
  name: string;
  actual: number;
  benchmark: number;
  unit: string;
  variance: number;
}

export async function getBenchmarkGap(db: Db, periodCode?: string) {
  const benchmarks = await readBenchmarks(db);

  const countRes = (await db.execute(sql`
    SELECT COUNT(*)::int AS "total" FROM employees WHERE status <> 'RESIGNED'
  `)) as unknown as { rows: Array<{ total: number }> };
  const totalEmployees = Number(countRes.rows[0]?.total ?? 0);

  const metrics: BenchmarkMetric[] = [
    {
      code: 'VMAI_TARGET',
      name: 'Vision & Mission Alignment Index',
      actual: 0,
      benchmark: benchmarks.VMAI_TARGET ?? 85,
      unit: 'percent',
      variance: 0,
    },
    {
      code: 'QOH_MIN',
      name: 'Quality of Hire Average',
      actual: 0,
      benchmark: benchmarks.QOH_MIN ?? 85,
      unit: 'score',
      variance: 0,
    },
  ];

  // Quality of Hire nyata dari recruitment_assessments
  const qoh = (await db.execute(sql`
    SELECT COALESCE(AVG(computed_qoh_score), 0) AS "avg" FROM recruitment_assessments
  `)) as unknown as { rows: Array<{ avg: string | number }> };
  metrics[1].actual = Number(Number(qoh.rows[0]?.avg ?? 0).toFixed(2));
  metrics[1].variance = Number((metrics[1].actual - metrics[1].benchmark).toFixed(2));

  return {
    period_code: periodCode ?? null,
    company_name: 'PT E-PerformIQ Nusantara',
    total_evaluated_employees: totalEmployees,
    metrics,
    generated_at: new Date().toISOString(),
  };
}

export async function getExecutiveSummary(db: Db, periodCode?: string) {
  const benchmarks = await readBenchmarks(db);

  const headcount = (await db.execute(sql`
    SELECT COUNT(*)::int AS "total",
           COUNT(*) FILTER (WHERE status = 'PROBATION')::int AS "probation",
           COUNT(*) FILTER (WHERE status = 'RESIGNED')::int AS "resigned"
      FROM employees
  `)) as unknown as { rows: Array<{ total: number; probation: number; resigned: number }> };
  const row = headcount.rows[0] ?? { total: 0, probation: 0, resigned: 0 };

  const appraisals = (await db.execute(sql`
    SELECT COUNT(*)::int AS "total",
           COALESCE(AVG(composite_gpa), 0) AS "avgGpa",
           COUNT(*) FILTER (WHERE nine_box_quadrant IN ('FUTURE_LEADER','GROWTH_STAR','ENIGMA'))::int AS "highPotential"
      FROM performance_appraisals
  `)) as unknown as { rows: Array<{ total: number; avgGpa: string | number; highPotential: number }> };
  const appr = appraisals.rows[0] ?? { total: 0, avgGpa: 0, highPotential: 0 };

  return {
    period_code: periodCode ?? null,
    headcount: { total: Number(row.total), probation: Number(row.probation), resigned: Number(row.resigned) },
    appraisal: {
      total_appraised: Number(appr.total),
      average_gpa: Number(Number(appr.avgGpa).toFixed(2)),
      high_potential_count: Number(appr.highPotential),
    },
    benchmarks: {
      turnover_max: benchmarks.TURNOVER_MAX ?? 3,
      vmai_target: benchmarks.VMAI_TARGET ?? 85,
    },
    generated_at: new Date().toISOString(),
  };
}

export async function getLifecycleSummary(db: Db) {
  const benchmarks = await readBenchmarks(db);

  const mpp = (await db.execute(sql`
    SELECT COALESCE(SUM(approved_quota), 0)::int AS "quota",
           COALESCE(SUM(hired_count), 0)::int AS "hired"
      FROM manpower_plans
  `)) as unknown as { rows: Array<{ quota: number; hired: number }> };
  const mppRow = mpp.rows[0] ?? { quota: 0, hired: 0 };
  const mppFulfillment = Number(mppRow.quota) > 0
    ? Number(((Number(mppRow.hired) / Number(mppRow.quota)) * 100).toFixed(1))
    : 0;

  const qoh = (await db.execute(sql`
    SELECT COALESCE(AVG(computed_qoh_score), 0) AS "avg" FROM recruitment_assessments
  `)) as unknown as { rows: Array<{ avg: string | number }> };
  const avgQoh = Number(Number(qoh.rows[0]?.avg ?? 0).toFixed(2));

  const probation = (await db.execute(sql`
    SELECT COUNT(*)::int AS "total",
           COUNT(*) FILTER (WHERE probation_passed = TRUE)::int AS "passed"
      FROM onboarding_milestones
  `)) as unknown as { rows: Array<{ total: number; passed: number }> };
  const probRow = probation.rows[0] ?? { total: 0, passed: 0 };
  const probationConversion = Number(probRow.total) > 0
    ? Number(((Number(probRow.passed) / Number(probRow.total)) * 100).toFixed(1))
    : 0;

  return {
    mpp_fulfillment_percentage: mppFulfillment,
    average_quality_of_hire: avgQoh,
    probation_conversion_percentage: probationConversion,
    sla_min_benchmark: benchmarks.SLA_MIN ?? 98,
    qoh_min_benchmark: benchmarks.QOH_MIN ?? 85,
    mpp_target_benchmark: benchmarks.MPP_TARGET ?? 95,
    generated_at: new Date().toISOString(),
  };
}
