// Strategic Alignment Engine: Vision & Mission Alignment Index (VMAI)
// (PRD Section 4.1 & Section 11.3)
import { StrategicPillar, VMAIScorecard } from '@/types';

export function calculateVMAI(
  pillars: StrategicPillar[],
  gcgComplianceFactor: number = 1.0,
  context: { totalEmployees?: number; periodCode?: string; industryTarget?: number } = {}
): VMAIScorecard {
  let weightedScoreSum = 0;
  let totalWeights = 0;

  const perspectives = {
    financial: { score: 0, status: 'NO_DATA', driver: 'Belum ada pilar Financial' },
    customer: { score: 0, status: 'NO_DATA', driver: 'Belum ada pilar Customer' },
    internalProcess: { score: 0, status: 'NO_DATA', driver: 'Belum ada pilar Internal Process' },
    learningGrowth: { score: 0, status: 'NO_DATA', driver: 'Belum ada pilar Learning & Growth' },
  };

  pillars.forEach((p) => {
    const ratio = p.targetScore > 0 ? (p.achievedScore / p.targetScore) : 0;
    weightedScoreSum += (p.strategicWeight * ratio * 100);
    totalWeights += p.strategicWeight;

    // Map to perspectives
    const normalizedScore = Number(((p.achievedScore / p.targetScore) * 100).toFixed(1));
    const status = normalizedScore >= 90 ? 'OPTIMAL' : normalizedScore >= 80 ? 'COMPLIANT' : 'ATTENTION_REQUIRED';
    if (p.perspective === 'FINANCIAL') {
      perspectives.financial = { score: normalizedScore, status, driver: p.pillarName };
    } else if (p.perspective === 'CUSTOMER') {
      perspectives.customer = { score: normalizedScore, status, driver: p.pillarName };
    } else if (p.perspective === 'INTERNAL_PROCESS') {
      perspectives.internalProcess = { score: normalizedScore, status, driver: p.pillarName };
    } else if (p.perspective === 'LEARNING_GROWTH') {
      perspectives.learningGrowth = { score: normalizedScore, status, driver: p.pillarName };
    }
  });

  const baseVMAI = totalWeights > 0 ? (weightedScoreSum / totalWeights) : 0;
  const overallVMAI = Number((baseVMAI * gcgComplianceFactor).toFixed(2));

  let alignmentStatus: 'EXCEPTIONAL' | 'ALIGNED' | 'SUB_STANDARD' | 'CRITICAL' = 'CRITICAL';
  let statusDescription = 'Belum ada data pilar strategis atau deviasi kritis.';

  if (overallVMAI >= 95.0) {
    alignmentStatus = 'EXCEPTIONAL';
    statusDescription = 'Exceptional Strategic Alignment - Accelerating Corporate Vision';
  } else if (overallVMAI >= 85.0) {
    alignmentStatus = 'ALIGNED';
    statusDescription = 'Healthy & Aligned - Corporate RJPP & Best Practices on Track';
  } else if (overallVMAI >= 70.0) {
    alignmentStatus = 'SUB_STANDARD';
    statusDescription = 'Sub-Standard Deviation Identified - Operational Review Required';
  } else if (overallVMAI > 0) {
    alignmentStatus = 'CRITICAL';
    statusDescription = 'Critical Misalignment - GCG Breach or Strategy Disconnect';
  }

  const industryTarget = context.industryTarget ?? 85.0;
  const variance = Number((overallVMAI - industryTarget).toFixed(2));

  return {
    periodCode: context.periodCode ?? '',
    overallVMAI,
    alignmentStatus,
    statusDescription,
    perspectives,
    gcgComplianceFactor,
    industryBenchmark: {
      target: industryTarget,
      actual: overallVMAI,
      variance,
      standing: overallVMAI >= 90 ? 'LEADER' : overallVMAI >= 85 ? 'ABOVE_AVERAGE' : 'MEDIAN',
    },
    totalEmployees: context.totalEmployees ?? 0,
    generatedAt: new Date().toISOString(),
  };
}
