// Strategic Alignment Engine: Vision & Mission Alignment Index (VMAI)
// (PRD Section 4.1 & Section 11.3)
import { StrategicPillar, VMAIScorecard } from '@/types';

export function calculateVMAI(pillars: StrategicPillar[], gcgComplianceFactor: number = 1.0): VMAIScorecard {
  let weightedScoreSum = 0;
  let totalWeights = 0;

  const perspectives = {
    financial: { score: 92.4, status: 'OPTIMAL', driver: 'MPP Budget Adherence & Cost Efficiency' },
    customer: { score: 87.1, status: 'COMPLIANT', driver: 'Internal CSAT & Onboarding Assimilation Index' },
    internalProcess: { score: 94.8, status: 'EXCELLENT', driver: 'Zero Fatal SOP Error & SLA Operational Speed' },
    learningGrowth: { score: 83.3, status: 'ATTENTION_REQUIRED', driver: 'Training Hours & Talent Retention in Tech' },
  };

  pillars.forEach((p) => {
    const ratio = p.targetScore > 0 ? (p.achievedScore / p.targetScore) : 1;
    weightedScoreSum += (p.strategicWeight * ratio * 100);
    totalWeights += p.strategicWeight;

    // Map to perspectives
    const normalizedScore = Number(((p.achievedScore / p.targetScore) * 100).toFixed(1));
    if (p.perspective === 'FINANCIAL') {
      perspectives.financial.score = normalizedScore;
    } else if (p.perspective === 'CUSTOMER') {
      perspectives.customer.score = normalizedScore;
    } else if (p.perspective === 'INTERNAL_PROCESS') {
      perspectives.internalProcess.score = normalizedScore;
    } else if (p.perspective === 'LEARNING_GROWTH') {
      perspectives.learningGrowth.score = normalizedScore;
    }
  });

  const baseVMAI = totalWeights > 0 ? (weightedScoreSum / totalWeights) : 89.4;
  const overallVMAI = Number((baseVMAI * gcgComplianceFactor).toFixed(2));

  let alignmentStatus: 'EXCEPTIONAL' | 'ALIGNED' | 'SUB_STANDARD' | 'CRITICAL' = 'ALIGNED';
  let statusDescription = 'Strategically Aligned with Leading Corporate Standard';

  if (overallVMAI >= 95.0) {
    alignmentStatus = 'EXCEPTIONAL';
    statusDescription = 'Exceptional Strategic Alignment - Accelerating Corporate Vision';
  } else if (overallVMAI >= 85.0) {
    alignmentStatus = 'ALIGNED';
    statusDescription = 'Healthy & Aligned - Corporate RJPP & Best Practices on Track';
  } else if (overallVMAI >= 70.0) {
    alignmentStatus = 'SUB_STANDARD';
    statusDescription = 'Sub-Standard Deviation Identified - Operational Review Required';
  } else {
    alignmentStatus = 'CRITICAL';
    statusDescription = 'Critical Misalignment - GCG Breach or Strategy Disconnect';
  }

  const industryTarget = 85.0;
  const variance = Number((overallVMAI - industryTarget).toFixed(2));

  return {
    periodCode: '2026-Q3',
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
    totalEmployees: 1240,
    generatedAt: new Date().toISOString(),
  };
}
