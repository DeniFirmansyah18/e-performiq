import type { Db } from '@/lib/db/client';
import { getVmaiScorecardData } from '@/lib/services/analyticsService';
import { getExecutiveSummary, getLifecycleSummary, getBenchmarkGap } from '@/lib/services/analyticsSummaryService';
import { listCourses } from '@/lib/services/learningLmsService';
import { listCandidates } from '@/lib/services/candidateService';

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
      case 'audit':
        return { feature: 'audit', note: 'Jejak audit anti-manipulasi & prinsip TARIF; lihat log audit.' };
      default:
        return { feature, note: 'Konteks generik: fitur tidak dikenali.' };
    }
  } catch (e: any) {
    return { feature, error: e?.message ?? 'context build failed' };
  }
}
