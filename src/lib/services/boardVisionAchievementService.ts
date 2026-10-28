import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { resolvePeriodId, periodCodeOf } from './periodResolver';

export type AchievementStatus = 'ACHIEVED' | 'BELOW_TARGET' | 'NO_DATA';

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
  pillars: VisionPillar[];
  rjmp: RjmpTarget[];
  analysis: {
    achievedPillarCount: number;
    belowTargetPillarCount: number;
    noDataPillarCount: number;
    weakestPillar: string | null;
    strongestPillar: string | null;
    highlights: string[];
  };
}

function round1(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

function statusOf(achievement: number, hasData: boolean): AchievementStatus {
  if (!hasData) return 'NO_DATA';
  return achievement >= 100 ? 'ACHIEVED' : 'BELOW_TARGET';
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

  const withData = pillars.filter((p) => p.status !== 'NO_DATA');
    // Spec §4: "rata-rata tertimbang seluruh pilar". Pilar NO_DATA bernilai 0%
    // pada bobotnya sendiri (bukan dikeluarkan dari penyebut), agar angka BOD
    // mencerminkan pilar yang belum terukur. Nilai khusus pilar terukur tetap
    // dilaporkan pada highlights sebagai konteks, bukan sebagai angka utama.
    const allWeightSum = pillars.reduce((s, p) => s + p.strategicWeight, 0);
    const overallAchievementPercentage =
      allWeightSum > 0
        ? round1(
            pillars.reduce((s, p) => s + p.achievementPercentage * p.strategicWeight, 0) /
              allWeightSum
          )
        : 0;

    const measuredWeightSum = withData.reduce((s, p) => s + p.strategicWeight, 0);
    const measuredOnlyAchievementPercentage =
      measuredWeightSum > 0
        ? round1(
            withData.reduce((s, p) => s + p.achievementPercentage * p.strategicWeight, 0) /
              measuredWeightSum
          )
        : 0;

        // Cakupan pengukuran dilaporkan terpisah dari capaian: satu angka capaian
        // tidak bisa memikul dua arti ("gagal" vs "belum diukur"), dan ISO 30414
        // menuntut disclosure cakupan data, bukan hanya nilainya.
        const measurementCoveragePercentage =
          allWeightSum > 0
            ? Math.min(100, Math.round((measuredWeightSum / allWeightSum) * 1000) / 10)
            : 0;

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
      pillars,
      rjmp,
    analysis: {
      achievedPillarCount,
      belowTargetPillarCount,
      noDataPillarCount,
      weakestPillar,
      strongestPillar,
      highlights,
    },
  };
}
