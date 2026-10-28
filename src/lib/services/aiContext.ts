import type { Db } from '@/lib/db/client';
import { getVmaiScorecardData } from '@/lib/services/analyticsService';
import { getExecutiveSummary, getLifecycleSummary, getBenchmarkGap } from '@/lib/services/analyticsSummaryService';
import { listCourses } from '@/lib/services/learningLmsService';
import { listCandidates } from '@/lib/services/candidateService';
import { getVisionAchievement } from './boardVisionAchievementService';
import { getPositionFit } from './boardPositionFitService';
import { getBoardActivityAnalytics } from './boardActivityAnalyticsService';
import { addDays, todayInJakarta } from '@/lib/utils/wibDate';

/** Jendela aktivitas untuk konteks AI: satu kuartal terakhir. */
const BOARD_CONTEXT_ACTIVITY_DAYS = 90;

/**
 * Merakit ringkasan data NYATA per fitur untuk konteks prompt Gemini.
 * Tidak pernah melempar: id tak dikenal -> objek generik.
 */
export async function buildFeatureContext(db: Db, feature: string): Promise<Record<string, unknown>> {
  try {
    switch (feature) {
      case 'executive': {
        const vmai = await getVmaiScorecardData(db);
        return {
          feature: 'executive',
          vmai: vmai.overallVMAI,
          alignment: vmai.alignmentStatus,
          period: vmai.periodCode,
          totalEmployees: vmai.totalEmployees,
          perspectives: {
            financial: vmai.perspectives.financial.score,
            customer: vmai.perspectives.customer.score,
            internal: vmai.perspectives.internalProcess.score,
            learning: vmai.perspectives.learningGrowth.score,
          },
        };
      }
      case 'hr': {
        const [exec, life, bench] = await Promise.all([
          getExecutiveSummary(db),
          getLifecycleSummary(db),
          getBenchmarkGap(db, undefined),
        ]);
        return { feature: 'hr', headcount: exec.headcount, lifecycle: life, benchmarks: bench.metrics };
      }
      case 'manager':
      case 'ninebox': {
        const exec = await getExecutiveSummary(db);
        return { feature, appraisal: exec.appraisal, headcount: exec.headcount };
      }
      case 'employee':
      case 'learning': {
        const courses = await listCourses(db);
        return { feature, coursesTotal: courses.length, courses };
      }
      case 'careers': {
        const candidates = await listCandidates(db);
        return { feature: 'careers', applicants: candidates.length };
      }
      case 'board': {
        // Allowlist eksplisit: hanya agregat non-RESTRICTED. Gaji, komponen
        // payroll, dan nomor BPJS sengaja TIDAK diambil sama sekali.
        const today = todayInJakarta();
        const [vision, fit, activity] = await Promise.all([
          getVisionAchievement(db),
          getPositionFit(db),
          getBoardActivityAnalytics(db, {
            fromDate: addDays(today, -(BOARD_CONTEXT_ACTIVITY_DAYS - 1)),
            toDate: today,
          }),
        ]);
        return {
          feature: 'board',
          vision: vision.vision,
          missions: vision.missions,
          overallAchievement: vision.overallAchievementPercentage,
                  // Cakupan pengukuran wajib ikut: tanpa ini model membaca pilar
                  // "belum dinilai" sebagai kinerja 0% dan menarasikannya sebagai
                  // kegagalan, padahal itu lubang cascade.
                  measurementCoverage: vision.measurementCoveragePercentage,
                  measuredAchievement: vision.measuredAchievementPercentage,
                  pillars: vision.pillars.map((p) => ({
                    name: p.pillarName,
                    perspective: p.perspective,
                    weight: p.strategicWeight,
                    achievement: p.achievementPercentage,
                    status: p.status,
                    measured: p.measured,
                  })),
          rjmp: vision.rjmp.map((r) => ({
            code: r.kpiCode,
            name: r.kpiName,
            target: r.targetValue,
            derivedAchievement: r.derivedAchievementPercentage,
            status: r.status,
          })),
          positionFit: {
            sampleSize: fit.sampleSize,
            compliantPositions: fit.analysis.compliantPositions,
            positionsWithoutTemplate: fit.analysis.positionsWithoutTemplate,
            averageCoverage: fit.analysis.averageCoveragePercentage,
          },
          activity: {
            totalEvents: activity.totalEvents,
            coveragePercentage: activity.analysis.coveragePercentage,
            busiestDepartment: activity.analysis.busiestDepartment,
            busiestEventType: activity.analysis.busiestEventType,
          },
        };
      }
      case 'audit':
        return { feature: 'audit', note: 'Jejak audit anti-manipulasi & prinsip TARIF; lihat log audit.' };
      default:
        return { feature, note: 'Konteks generik: fitur tidak dikenali.' };
    }
  } catch (e: any) {
    return { feature, error: e?.message ?? 'context build failed' };
  }
}
