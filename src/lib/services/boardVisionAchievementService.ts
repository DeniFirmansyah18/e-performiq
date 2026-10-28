import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { resolvePeriodId, periodCodeOf } from './periodResolver';
import {
  ACHIEVEMENT_FORMULA_VERSION,
  overallAchievement,
  measuredAchievement,
  measurementCoverage,
  measuredWeightOf,
  totalWeightOf,
  round1,
  statusOf,
  type AchievementStatus,
  type PillarMeasurement,
} from '@/lib/strategy/achievementFormula';

export type { AchievementStatus };

export interface VisionPillar {
  pillarId: string;
  pillarName: string;
  perspective: string;
  strategicWeight: number;
  kpiCount: number;
  achievementPercentage: number;
  status: AchievementStatus;
  /**
   * `false` bila pilar belum punya KPI. Dibedakan dari `BELOW_TARGET` agar
   * pembaca tidak menyimpulkan kegagalan kinerja padahal yang terjadi adalah
   * lubang cascade (KPI korporat belum diturunkan ke KPI individual).
   */
  measured: boolean;
}

export interface RjmpTarget {
  corporateKpiId: string;
  kpiCode: string;
  kpiName: string;
  periodYear: number;
  targetValue: number;
  unit: string;
  derivedAchievementPercentage: number;
  status: AchievementStatus;
}

/** Satu baris register cascade: KPI korporat dan kesiapannya diturunkan. */
export interface CascadeGap {
  corporateKpiId: string;
  kpiCode: string;
  kpiName: string;
  pillarId: string;
  pillarName: string;
  pillarPerspective: string;
  /** Jumlah template jabatan yang menaungi pilar KPI ini. */
  templateCount: number;
  /** Berapa template yang sudah punya KPI individual cocok. */
  coveredTemplateCount: number;
  /** Jabatan yang wajib diberi KPI — daftar kerja untuk HR/PMO. */
  positionsMissingKpi: string[];
}

/** Temuan tata kelola formal (bukan sekadar catatan kaki). */
export interface GovernanceFinding {
  code: 'UNMEASURED_CONSECUTIVE_PERIODS';
  severity: 'GOVERNANCE';
  pillarId: string;
  pillarName: string;
  perspective: string;
  /** Kode periode berurutan yang sama-sama tanpa KPI. */
  periods: string[];
  message: string;
}

export interface VisionAchievement {
  vision: string | null;
  missions: string[];
  /** Periode yang benar-benar diagregasi; `null` bila tidak ada periode dikenal. */
  periodCode: string | null;
  sampleSize: number;
  /**
   * ANGKA RESMI capaian korporat: rata-rata tertimbang SELURUH pilar (spec §4).
   *
   * Pilar tanpa KPI bernilai 0% pada bobotnya sendiri, bukan dikeluarkan dari
   * penyebut. Alasannya bukan semata kepatuhan spec: normalisasi ulang membuat
   * skor NAIK hanya dengan tidak menyusun KPI, sehingga kelalaian administratif
   * berubah menjadi perbaikan kinerja. Karena itu angka ini dipertahankan
   * sebagai satu-satunya capaian resmi.
   */
  overallAchievementPercentage: number;
  /**
   * Capaian pada pilar yang BENAR-BENAR terukur. Hanya untuk konteks pelaporan
   * (mis. "92,8% pada 75% bobot terukur") — jangan dipakai sebagai headline,
   * jangan dipakai menilai Direksi.
   */
  measuredAchievementPercentage: number;
  /** Porsi bobot strategis yang punya data KPI, dalam persen (0-100). */
  measurementCoveragePercentage: number;
  /** Bobot pilar yang terukur (mis. 75 dari 100). */
  measuredWeight: number;
  /** Total bobot seluruh pilar aktif (biasanya 100). */
  totalWeight: number;
    /** Versi basis perhitungan (ADR 021) — agar laporan dapat ditelusuri. */
    formulaVersion: string;
    pillars: VisionPillar[];
    rjmp: RjmpTarget[];
    /** Register kerja: KPI korporat yang belum punya KPI individual. */
    cascadeGaps: CascadeGap[];
    analysis: {
      achievedPillarCount: number;
      belowTargetPillarCount: number;
      noDataPillarCount: number;
      weakestPillar: string | null;
      strongestPillar: string | null;
      /** Periode pembanding untuk aturan dua periode; `null` bila tidak ada. */
      previousPeriodCode: string | null;
      governanceFindings: GovernanceFinding[];
      highlights: string[];
    };
  }

export async function getVisionAchievement(
  db: Db,
  periodCode?: string
): Promise<VisionAchievement> {
  const vmRes = (await db.execute(sql`
    SELECT vision, mission FROM company_vision_mission ORDER BY updated_at DESC LIMIT 1
  `)) as unknown as { rows: Array<{ vision: string; mission: string }> };

  const vision = vmRes.rows?.[0]?.vision ?? null;
  const missionText = vmRes.rows?.[0]?.mission ?? '';
  const missions = missionText
    ? missionText.split(/\s*\|\s*|\n+/).map((m) => m.trim()).filter(Boolean)
    : [];

  // Periode wajib dipilih: mencampur beberapa kuartal menghasilkan capaian
  // yang tidak menggambarkan periode mana pun. Tanpa kode periode, dipakai
  // periode ACTIVE terbaru; kode tak dikenal menghasilkan data kosong.
  const periodId = await resolvePeriodId(db, periodCode);
  const periodFilter = periodId === null
    ? sql`FALSE`
    : sql`ik.period_id = ${periodId}::uuid`;
  const resolvedPeriodCode = await periodCodeOf(db, periodId);

  // Rata-rata tertimbang bobot KPI; SUM(kpi_weight)=0 menghasilkan 0, bukan NaN.
  const pillarRes = (await db.execute(sql`
    SELECT
      sp.id AS "pillarId",
      sp.pillar_name AS "pillarName",
      sp.perspective::text AS perspective,
      sp.strategic_weight::float8 AS "strategicWeight",
      COUNT(ik.id)::int AS "kpiCount",
      COALESCE(SUM(ik.kpi_weight), 0)::float8 AS "totalWeight",
      CASE
        WHEN COALESCE(SUM(ik.kpi_weight), 0) > 0
        THEN (SUM(ik.achievement_percentage * ik.kpi_weight) / SUM(ik.kpi_weight))::float8
        ELSE 0
      END AS achievement
    FROM strategic_pillars sp
    LEFT JOIN individual_kpis ik
      ON ik.strategic_pillar_id = sp.id
     AND ${periodFilter}
    WHERE sp.is_active = TRUE
    GROUP BY sp.id, sp.pillar_name, sp.perspective, sp.strategic_weight
    ORDER BY sp.strategic_weight DESC, sp.pillar_name ASC
  `)) as unknown as {
    rows: Array<{
      pillarId: string;
      pillarName: string;
      perspective: string;
      strategicWeight: number;
      kpiCount: number;
      totalWeight: number;
      achievement: number;
    }>;
  };

  const pillars: VisionPillar[] = (pillarRes.rows ?? []).map((r) => {
      const hasData = Number(r.kpiCount) > 0 && Number(r.totalWeight) > 0;
      const achievement = hasData ? round1(Number(r.achievement)) : 0;
      return {
        pillarId: r.pillarId,
        pillarName: r.pillarName,
        perspective: r.perspective,
        strategicWeight: Number(r.strategicWeight),
        kpiCount: Number(r.kpiCount),
        achievementPercentage: achievement,
        status: statusOf(achievement, hasData),
        measured: hasData,
      };
    });

    const withData = pillars.filter((p) => p.measured);

    // Seluruh angka capaian berasal dari modul terkunci (ADR 021) — jangan
    // menghitung ulang di sini agar kode tidak dapat menyimpang dari dokumen.
    const pillarMeasurements: PillarMeasurement[] = pillars.map((p) => ({
      weight: p.strategicWeight,
      achievement: p.achievementPercentage,
      measured: p.measured,
    }));

    const overallAchievementPercentage = overallAchievement(pillarMeasurements);
    const measuredOnlyAchievementPercentage = measuredAchievement(pillarMeasurements);
    const measurementCoveragePercentage = measurementCoverage(pillarMeasurements);
    const measuredWeightSum = measuredWeightOf(pillarMeasurements);
    const allWeightSum = totalWeightOf(pillarMeasurements);

  const rjmpRes = (await db.execute(sql`
    SELECT ck.id AS "corporateKpiId", ck.kpi_code AS "kpiCode", ck.kpi_name AS "kpiName",
           ck.period_year AS "periodYear", ck.target_value::float8 AS "targetValue",
           ck.unit_of_measure AS unit, ck.strategic_pillar_id AS "pillarId"
      FROM corporate_kpis ck
     ORDER BY ck.period_year DESC, ck.kpi_code ASC
  `)) as unknown as {
    rows: Array<{
      corporateKpiId: string;
      kpiCode: string;
      kpiName: string;
      periodYear: number;
      targetValue: number;
      unit: string;
      pillarId: string;
    }>;
  };

  const pillarById = new Map(pillars.map((p) => [p.pillarId, p]));
  const rjmp: RjmpTarget[] = (rjmpRes.rows ?? []).map((r) => {
    const pillar = pillarById.get(r.pillarId);
    const hasData = !!pillar && pillar.status !== 'NO_DATA';
    const derived = hasData ? pillar!.achievementPercentage : 0;
    return {
      corporateKpiId: r.corporateKpiId,
      kpiCode: r.kpiCode,
      kpiName: r.kpiName,
      periodYear: Number(r.periodYear),
      targetValue: Number(r.targetValue),
      unit: r.unit,
      derivedAchievementPercentage: derived,
      status: statusOf(derived, hasData),
    };
  });

  const achievedPillarCount = pillars.filter((p) => p.status === 'ACHIEVED').length;
  const belowTargetPillarCount = pillars.filter((p) => p.status === 'BELOW_TARGET').length;
  const noDataPillarCount = pillars.filter((p) => p.status === 'NO_DATA').length;

    // --- Register cascade: KPI korporat yang belum punya KPI individual ---
    // Tanpa daftar ini, laporan hanya menyebut gejala ("1 pilar belum dinilai")
    // tanpa pekerjaan yang bisa ditugaskan ke pemilik proses.
    const cascadeRes = (await db.execute(sql`
      WITH tpl AS (
        SELECT t.position_id,
               t.strategic_pillar_id AS pillar_id,
               LOWER(TRIM(t.kpi_title)) AS title_lc
          FROM position_kpi_templates t
         WHERE t.is_active = TRUE
           AND t.strategic_pillar_id IS NOT NULL
      ),
      covered AS (
        SELECT tpl.pillar_id,
               COUNT(DISTINCT tpl.position_id)::int AS templates_with_individual
          FROM tpl
         WHERE EXISTS (
                 SELECT 1
                   FROM employees e
                   JOIN individual_kpis ik ON ik.employee_id = e.id
                  WHERE e.position_id = tpl.position_id
                    AND LOWER(TRIM(ik.kpi_title)) = tpl.title_lc
               )
         GROUP BY tpl.pillar_id
      ),
      totals AS (
        SELECT pillar_id, COUNT(DISTINCT position_id)::int AS templates
          FROM tpl GROUP BY pillar_id
      )
      SELECT ck.id AS "corporateKpiId", ck.kpi_code AS "kpiCode", ck.kpi_name AS "kpiName",
             sp.id AS "pillarId", sp.pillar_name AS "pillarName",
             sp.perspective::text AS "pillarPerspective",
             COALESCE(tt.templates, 0)::int AS "templateCount",
             COALESCE(cv.templates_with_individual, 0)::int AS "coveredTemplateCount"
        FROM corporate_kpis ck
        JOIN strategic_pillars sp ON sp.id = ck.strategic_pillar_id
        LEFT JOIN totals tt ON tt.pillar_id = ck.strategic_pillar_id
        LEFT JOIN covered cv ON cv.pillar_id = ck.strategic_pillar_id
       ORDER BY ck.kpi_code ASC
    `)) as unknown as {
      rows: Array<{
        corporateKpiId: string;
        kpiCode: string;
        kpiName: string;
        pillarId: string;
        pillarName: string;
        pillarPerspective: string;
        templateCount: number;
        coveredTemplateCount: number;
      }>;
    };

    // Jabatan mana yang wajib diberi KPI: template pada pilar yang belum tertutup.
    const missingPositionsRes = (await db.execute(sql`
      SELECT DISTINCT t.strategic_pillar_id AS "pillarId", jp.position_title AS "positionTitle"
        FROM position_kpi_templates t
        JOIN job_positions jp ON jp.id = t.position_id
       WHERE t.is_active = TRUE AND t.strategic_pillar_id IS NOT NULL
       ORDER BY jp.position_title ASC
    `)) as unknown as { rows: Array<{ pillarId: string; positionTitle: string }> };
    const positionsByPillar = new Map<string, string[]>();
    for (const row of missingPositionsRes.rows ?? []) {
      const list = positionsByPillar.get(row.pillarId) ?? [];
      if (!list.includes(row.positionTitle)) list.push(row.positionTitle);
      positionsByPillar.set(row.pillarId, list);
    }

    const cascadeGaps: CascadeGap[] = (cascadeRes.rows ?? [])
      .filter((r) => Number(r.coveredTemplateCount) === 0)
      .map((r) => ({
        corporateKpiId: r.corporateKpiId,
        kpiCode: r.kpiCode,
        kpiName: r.kpiName,
        pillarId: r.pillarId,
        pillarName: r.pillarName,
        pillarPerspective: r.pillarPerspective,
        templateCount: Number(r.templateCount),
        coveredTemplateCount: Number(r.coveredTemplateCount),
        positionsMissingKpi: positionsByPillar.get(r.pillarId) ?? [],
      }));

    // --- Aturan dua periode: pilar tanpa KPI dua periode berturut-turut ---
    const previousPeriod = (await db.execute(sql`
      SELECT ap.id, ap.period_code AS "periodCode"
        FROM appraisal_periods ap
       WHERE ${periodId === null ? sql`FALSE` : sql`ap.id <> ${periodId}::uuid`}
         AND ap.period_code < ${resolvedPeriodCode ?? ''}
       ORDER BY ap.period_code DESC
       LIMIT 1
    `)) as unknown as { rows: Array<{ id: string; periodCode: string }> };
    const previousPeriodRow = previousPeriod.rows?.[0] ?? null;

    const previousMeasured = new Set<string>();
    if (previousPeriodRow) {
      const prevRes = (await db.execute(sql`
        SELECT DISTINCT ik.strategic_pillar_id AS "pillarId"
          FROM individual_kpis ik
          JOIN strategic_pillars sp ON sp.id = ik.strategic_pillar_id
         WHERE ik.period_id = ${previousPeriodRow.id}::uuid
           AND COALESCE(ik.kpi_weight, 0) > 0
      `)) as unknown as { rows: Array<{ pillarId: string }> };
      for (const row of prevRes.rows ?? []) previousMeasured.add(row.pillarId);
    }

    const governanceFindings: GovernanceFinding[] = previousPeriodRow
      ? pillars
          .filter((p) => !p.measured && !previousMeasured.has(p.pillarId))
          .map((p) => ({
            code: 'UNMEASURED_CONSECUTIVE_PERIODS' as const,
            severity: 'GOVERNANCE' as const,
            pillarId: p.pillarId,
            pillarName: p.pillarName,
            perspective: p.perspective,
            periods: [previousPeriodRow.periodCode, resolvedPeriodCode ?? ''],
            message:
              `Pilar ${p.pillarName} tanpa KPI pada ${previousPeriodRow.periodCode} dan ` +
              `${resolvedPeriodCode}. Ini temuan tata kelola, bukan kinerja: ` +
              `KPI korporat belum diturunkan ke KPI individual.`,
          }))
      : [];

    const sorted = [...withData].sort(
    (a, b) => b.achievementPercentage - a.achievementPercentage
  );
  const strongestPillar = sorted[0]?.pillarName ?? null;
  const weakestPillar = sorted[sorted.length - 1]?.pillarName ?? null;

  const highlights: string[] = [];
  if (pillars.length === 0) {
      highlights.push('Belum ada pilar strategis aktif untuk diukur.');
    } else {
      highlights.push(
        `Capaian resmi ${overallAchievementPercentage}% dari ${pillars.length} pilar ` +
          `(seluruh bobot ${allWeightSum}%).`
      );
      if (measuredWeightSum < allWeightSum) {
        highlights.push(
          `Cakupan pengukuran ${measurementCoveragePercentage}% bobot ` +
            `(${measuredWeightSum} dari ${allWeightSum}); ` +
            `pada bagian yang terukur capaiannya ${measuredOnlyAchievementPercentage}%.`
        );
      }
      if (weakestPillar && sorted.length > 1) {
        const gap = round1(sorted[0].achievementPercentage - sorted[sorted.length - 1].achievementPercentage);
        highlights.push(`Pilar terlemah: ${weakestPillar}, tertinggal ${gap} poin dari pilar terkuat.`);
      }
      if (noDataPillarCount > 0) {
        const names = pillars.filter((p) => !p.measured).map((p) => p.pillarName).join(', ');
        highlights.push(
          `${noDataPillarCount} pilar belum dinilai karena belum memiliki KPI: ${names}. ` +
            `Ini lubang cascade, bukan kegagalan kinerja — turunkan KPI korporat terkait ` +
            `ke KPI individual agar dapat dinilai pada periode berikutnya.`
        );
      }
            if (cascadeGaps.length > 0) {
              const positions = Array.from(
                new Set(cascadeGaps.flatMap((g) => g.positionsMissingKpi))
              );
              highlights.push(
                `${cascadeGaps.length} KPI korporat belum memiliki KPI individual yang cocok ` +
                  `(${cascadeGaps.map((g) => g.kpiCode).join(', ')}). ` +
                  `Posisi yang perlu diberi KPI: ${positions.slice(0, 5).join('; ')}` +
                  `${positions.length > 5 ? ` dan ${positions.length - 5} lainnya` : ''}.`
              );
            }
            for (const finding of governanceFindings) {
              highlights.push(`TEMUAN TATA KELOLA: ${finding.message}`);
            }
          }

  return {
    vision,
    missions,
    periodCode: resolvedPeriodCode,
    sampleSize: pillars.reduce((s, p) => s + p.kpiCount, 0),
    overallAchievementPercentage,
      measuredAchievementPercentage: measuredOnlyAchievementPercentage,
      measurementCoveragePercentage,
      measuredWeight: measuredWeightSum,
          totalWeight: allWeightSum,
          formulaVersion: ACHIEVEMENT_FORMULA_VERSION,
          pillars,
          rjmp,
          cascadeGaps,
          analysis: {
            achievedPillarCount,
            belowTargetPillarCount,
            noDataPillarCount,
            weakestPillar,
            strongestPillar,
            previousPeriodCode: previousPeriodRow?.periodCode ?? null,
            governanceFindings,
            highlights,
    },
  };
}
