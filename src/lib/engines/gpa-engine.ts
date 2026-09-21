// GPA Calculation Engine (PRD Section 3.2 & Section 11.3)
import { NineBoxQuadrant } from '@/types';

export interface GPARequest {
  kpiScore: number;         // Actual KPI achievement % (50%)
  sopScore: number;         // SOP compliance % (20%)
  competencyScore: number;  // Competency mastery % (15%)
  coreValuesScore: number;  // 360 Core values % (15%)
  potentialScore?: number;  // Potential 1.0 - 5.0
}

export interface GPAResult {
  breakdown: {
    kpiWeighted: number;
    sopWeighted: number;
    competencyWeighted: number;
    coreValuesWeighted: number;
  };
  totalPercentage: number;
  compositeGPA: number;
  rating: 'A' | 'B' | 'C' | 'D';
  nineBoxQuadrant: NineBoxQuadrant;
  ratingDescription: string;
}

export function calculateCompositeGPA(req: GPARequest): GPAResult {
  // Weights defined in PRD Section 3.2
  const wKPI = 0.50;
  const wSOP = 0.20;
  const wComp = 0.15;
  const wValues = 0.15;

  const kpiWeighted = Number((req.kpiScore * wKPI).toFixed(2));
  const sopWeighted = Number((req.sopScore * wSOP).toFixed(2));
  const competencyWeighted = Number((req.competencyScore * wComp).toFixed(2));
  const coreValuesWeighted = Number((req.coreValuesScore * wValues).toFixed(2));

  const totalPercentage = Number(
    (kpiWeighted + sopWeighted + competencyWeighted + coreValuesWeighted).toFixed(2)
  );

  // Composite GPA scaled to 4.00
  // Formula: (TotalScore / 100) * 4.00 with minimum 1.00
  const compositeGPA = Number(Math.min(4.0, Math.max(0, (totalPercentage / 100) * 4.0)).toFixed(2));

  let rating: 'A' | 'B' | 'C' | 'D' = 'C';
  let ratingDescription = 'Needs Improvement';

  if (totalPercentage >= 90) {
    rating = 'A';
    ratingDescription = 'Exceptional Performance (Exceeds Target)';
  } else if (totalPercentage >= 80) {
    rating = 'B';
    ratingDescription = 'Strong Performance (Meets Standard)';
  } else if (totalPercentage >= 70) {
    rating = 'C';
    ratingDescription = 'Acceptable (Sub-Standard / Gap Identified)';
  } else {
    rating = 'D';
    ratingDescription = 'Unsatisfactory (Critical Intervention Required)';
  }

  // Potential defaults to 3.5 if not passed
  const pot = req.potentialScore ?? 3.5;
  const nineBoxQuadrant = determineNineBox(totalPercentage, pot);

  return {
    breakdown: {
      kpiWeighted,
      sopWeighted,
      competencyWeighted,
      coreValuesWeighted,
    },
    totalPercentage,
    compositeGPA,
    rating,
    nineBoxQuadrant,
    ratingDescription,
  };
}

export function determineNineBox(perfScore: number, potentialScore: number): NineBoxQuadrant {
  const isHighPerf = perfScore >= 90;
  const isMedPerf = perfScore >= 75 && perfScore < 90;
  const isLowPerf = perfScore < 75;

  const isHighPot = potentialScore >= 4.0;
  const isMedPot = potentialScore >= 3.0 && potentialScore < 4.0;
  const isLowPot = potentialScore < 3.0;

  if (isHighPerf) {
    if (isHighPot) return 'FUTURE_LEADER';
    if (isMedPot) return 'HIGH_IMPACT';
    return 'TRUSTED_PRO';
  } else if (isMedPerf) {
    if (isHighPot) return 'GROWTH_STAR';
    if (isMedPot) return 'CORE_PLAYER';
    return 'EFFECTIVE_PRO';
  } else {
    if (isHighPot) return 'ENIGMA';
    if (isMedPot) return 'DILEMMA';
    return 'UNDERPERFORMER';
  }
}
