// Domain Types based on PRD E-PerformIQ & PostgreSQL ERD (Section 10)

export type UserRole = 'SUPER_ADMIN' | 'BOD' | 'HR_MANAGER' | 'PEOPLE_MANAGER' | 'EMPLOYEE' | 'AUDITOR';

export type EmployeeStatus = 'PROBATION' | 'PERMANENT' | 'CONTRACT' | 'RESIGNED' | 'RETIRED';

export type BSCPerspective = 'FINANCIAL' | 'CUSTOMER' | 'INTERNAL_PROCESS' | 'LEARNING_GROWTH';

export type NineBoxQuadrant = 
  | 'ENIGMA' 
  | 'GROWTH_STAR' 
  | 'FUTURE_LEADER'
  | 'DILEMMA' 
  | 'CORE_PLAYER' 
  | 'HIGH_IMPACT'
  | 'UNDERPERFORMER' 
  | 'EFFECTIVE_PRO' 
  | 'TRUSTED_PRO';

export interface User {
  id: string;
  employeeId: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  department: string;
  position: string;
}

export interface StrategicPillar {
  id: string;
  perspective: BSCPerspective;
  pillarName: string;
  description: string;
  strategicWeight: number; // percentage (sum = 100)
  achievedScore: number;
  targetScore: number;
}

export interface CorporateKPI {
  id: string;
  strategicPillarId: string;
  kpiCode: string;
  kpiName: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  periodYear: number;
}

export interface Employee {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  managerId?: string;
  managerName?: string;
  status: EmployeeStatus;
  baseSalary: number;
  joinDate: string;
  lastWorkingDay?: string;
  avatarUrl?: string;
  gpa?: number;
  rating?: string;
  nineBoxQuadrant?: NineBoxQuadrant;
}

export interface IndividualKPI {
  id: string;
  employeeId: string;
  periodId: string;
  strategicPillarId: string;
  strategicPillarName: string;
  kpiTitle: string;
  targetValue: number;
  actualValue: number;
  unit: string;
  weight: number; // 0-100
  achievementPercentage: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
}

export interface SOPComplianceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  periodId: string;
  totalTasks: number;
  slaBreachCount: number;
  procedureErrors: number;
  compliancePercentage: number;
  internalAuditFindings?: string;
}

export interface CompetencyAssessment {
  id: string;
  employeeId: string;
  skillName: string;
  skillCategory: 'HARD' | 'SOFT';
  requiredLevel: number; // 1-5
  actualLevel: number;   // 1-5
  gap: number;
  score: number; // 0-100
}

export interface PeerReview360 {
  id: string;
  evaluateeId: string;
  evaluatorId: string;
  evaluatorName: string;
  evaluatorRole: string;
  relationshipType: 'SUPERVISOR' | 'PEER' | 'SUBORDINATE';
  integrityScore: number; // 1-5
  collaborationScore: number; // 1-5
  innovationScore: number; // 1-5
  averageScore: number; // 1-5
  feedbackNotes: string;
  submittedAt: string;
}

export interface PerformanceAppraisal {
  id: string;
  periodId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  position: string;
  kpiScore: number;        // 50% weight
  sopScore: number;        // 20% weight
  competencyScore: number; // 15% weight
  coreValuesScore: number; // 15% weight
  totalPercentage: number; // 0-100
  compositeGPA: number;    // 0.00-4.00
  rating: 'A' | 'B' | 'C' | 'D';
  potentialScore: number;  // 1-5
  nineBoxQuadrant: NineBoxQuadrant;
  isCalibrated: boolean;
  calibratedBy?: string;
  calibratedAt?: string;
}

export interface ManpowerPlan {
  id: string;
  department: string;
  position: string;
  fiscalYear: number;
  approvedQuota: number;
  hiredCount: number;
  allocatedBudget: number;
  utilizedBudget: number;
}

export interface RecruitmentAssessment {
  id: string;
  candidateName: string;
  appliedPosition: string;
  department: string;
  psychometricScore: number;
  technicalTestScore: number;
  competencyInterviewScore: number;
  computedQoH: number; // Quality of Hire >= 85 target
  timeToFillDays: number;
  recruitmentCost: number;
  hiringStatus: 'APPLIED' | 'SCREENING' | 'INTERVIEWED' | 'OFFERED' | 'HIRED' | 'REJECTED';
}

export interface OnboardingMilestone {
  id: string;
  employeeId: string;
  employeeName: string;
  position: string;
  day30Score: number;
  day60Score: number;
  day90Score: number;
  probationPassed: boolean;
  managerNotes: string;
  conversionDate?: string;
}

export interface OffboardingRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  position: string;
  department: string;
  joinDate: string;
  resignationNoticeDate: string;
  lastWorkingDay: string;
  serviceYears: number;
  baseSalary: number;
  reasonForLeaving: string;
  isRegrettableAttrition: boolean; // Top 20% talent
  status: 'INITIATED' | 'CLEARANCE_IN_PROGRESS' | 'COMPLETED' | 'DISPUTED';
  handoverProgress: number; // 0-100%
}

export interface KnowledgeHandover {
  id: string;
  offboardingRequestId: string;
  itemName: string;
  category: 'DOCUMENTATION' | 'SOURCE_CODE' | 'PHYSICAL_ASSET' | 'ACCESS_KEY';
  handoverToEmployeeName: string;
  isVerified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface SeveranceCalculation {
  id: string;
  offboardingRequestId: string;
  employeeName: string;
  serviceYears: number;
  baseSalary: number;
  severancePay: number;            // Uang Pesangon (UP)
  serviceAppreciationPay: number;  // Uang Penghargaan Masa Kerja (UPMK)
  compensationPay: number;         // Uang Penggantian Hak (UPH) 15%
  dplkTopup: number;               // DPLK / JHT
  totalDisbursement: number;
  slaDisbursedDays: number;
  isPaid: boolean;
  paymentReferenceNo?: string;
  paidAt?: string;
}

export interface LifetimeContribution {
  id: string;
  employeeId: string;
  employeeName: string;
  achievementTitle: string;
  achievementType: 'PATENT' | 'KAIZEN_SAVING' | 'MENTORSHIP' | 'REVENUE_IMPACT';
  quantifiedImpactIdr: number;
  pointsAwarded: number;
  dateAchieved: string;
}

export interface VMAIScorecard {
  periodCode: string;
  overallVMAI: number; // Percentage, e.g. 89.4%
  alignmentStatus: 'EXCEPTIONAL' | 'ALIGNED' | 'SUB_STANDARD' | 'CRITICAL';
  statusDescription: string;
  perspectives: {
    financial: { score: number; status: string; driver: string };
    customer: { score: number; status: string; driver: string };
    internalProcess: { score: number; status: string; driver: string };
    learningGrowth: { score: number; status: string; driver: string };
  };
  gcgComplianceFactor: number; // 0.0 - 1.0
  industryBenchmark: {
    target: number;
    actual: number;
    variance: number;
    standing: 'LEADER' | 'ABOVE_AVERAGE' | 'MEDIAN' | 'BELOW';
  };
  totalEmployees: number;
  generatedAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  userRole: UserRole;
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'CALIBRATE' | 'DISBURSE' | 'APPROVE';
  entityName: string;
  recordId: string;
  description: string;
  oldData?: Record<string, any>;
  newData?: Record<string, any>;
  ipAddress: string;
}
