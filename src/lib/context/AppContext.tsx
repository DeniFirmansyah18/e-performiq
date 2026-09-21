'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Employee,
  IndividualKPI,
  SOPComplianceRecord,
  PeerReview360,
  PerformanceAppraisal,
  ManpowerPlan,
  RecruitmentAssessment,
  OnboardingMilestone,
  OffboardingRequest,
  KnowledgeHandover,
  SeveranceCalculation,
  LifetimeContribution,
  StrategicPillar,
  AuditLog,
  UserRole,
} from '@/types';
import {
  DUMMY_EMPLOYEES,
  DUMMY_BUDI_KPIS,
  DUMMY_APPRAISAL_BUDI,
  DUMMY_SOP_LOGS,
  DUMMY_PEER_REVIEWS,
  DUMMY_MANPOWER_PLANS,
  DUMMY_RECRUITMENT,
  DUMMY_ONBOARDING,
  DUMMY_OFFBOARDING,
  DUMMY_KNOWLEDGE_HANDOVERS,
  DUMMY_SEVERANCE,
  DUMMY_LCI,
  DUMMY_STRATEGIC_PILLARS,
  DUMMY_AUDIT_LOGS,
} from '@/lib/dummy-data';
import { calculateCompositeGPA } from '@/lib/engines/gpa-engine';

interface AppContextType {
  employees: Employee[];
  kpis: IndividualKPI[];
  appraisalBudi: PerformanceAppraisal;
  sopLogs: SOPComplianceRecord[];
  peerReviews: PeerReview360[];
  manpowerPlans: ManpowerPlan[];
  recruitmentList: RecruitmentAssessment[];
  onboardingList: OnboardingMilestone[];
  offboardingRequests: OffboardingRequest[];
  knowledgeHandovers: KnowledgeHandover[];
  severanceRecord: SeveranceCalculation;
  lifetimeContributions: LifetimeContribution[];
  strategicPillars: StrategicPillar[];
  auditLogs: AuditLog[];
  // Actions
  approveKPI: (kpiId: string, actorName: string, actorRole: UserRole) => void;
  updateKPIActual: (kpiId: string, actualValue: number) => void;
  submitPeerReview: (review: Omit<PeerReview360, 'id' | 'submittedAt'>) => void;
  convertProbation: (onboardingId: string, actorName: string) => void;
  verifyHandoverItem: (handoverId: string, verifierName: string) => void;
  disburseSeverancePayment: (severanceId: string, actorName: string) => void;
  recalculateBudiGPA: (kpi: number, sop: number, comp: number, val: number, pot?: number) => void;
  logAuditAction: (
    userName: string,
    userRole: UserRole,
    actionType: AuditLog['actionType'],
    entityName: string,
    recordId: string,
    description: string,
    oldData?: any,
    newData?: any
  ) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>(DUMMY_EMPLOYEES);
  const [kpis, setKpis] = useState<IndividualKPI[]>(DUMMY_BUDI_KPIS);
  const [appraisalBudi, setAppraisalBudi] = useState<PerformanceAppraisal>(DUMMY_APPRAISAL_BUDI);
  const [sopLogs, setSopLogs] = useState<SOPComplianceRecord[]>(DUMMY_SOP_LOGS);
  const [peerReviews, setPeerReviews] = useState<PeerReview360[]>(DUMMY_PEER_REVIEWS);
  const [manpowerPlans, setManpowerPlans] = useState<ManpowerPlan[]>(DUMMY_MANPOWER_PLANS);
  const [recruitmentList, setRecruitmentList] = useState<RecruitmentAssessment[]>(DUMMY_RECRUITMENT);
  const [onboardingList, setOnboardingList] = useState<OnboardingMilestone[]>(DUMMY_ONBOARDING);
  const [offboardingRequests, setOffboardingRequests] = useState<OffboardingRequest[]>(DUMMY_OFFBOARDING);
  const [knowledgeHandovers, setKnowledgeHandovers] = useState<KnowledgeHandover[]>(DUMMY_KNOWLEDGE_HANDOVERS);
  const [severanceRecord, setSeveranceRecord] = useState<SeveranceCalculation>(DUMMY_SEVERANCE);
  const [lifetimeContributions, setLifetimeContributions] = useState<LifetimeContribution[]>(DUMMY_LCI);
  const [strategicPillars, setStrategicPillars] = useState<StrategicPillar[]>(DUMMY_STRATEGIC_PILLARS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(DUMMY_AUDIT_LOGS);

  const logAuditAction = (
    userName: string,
    userRole: UserRole,
    actionType: AuditLog['actionType'],
    entityName: string,
    recordId: string,
    description: string,
    oldData?: any,
    newData?: any
  ) => {
    const newLog: AuditLog = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userName,
      userRole,
      actionType,
      entityName,
      recordId,
      description,
      oldData,
      newData,
      ipAddress: '10.24.110.88',
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const approveKPI = (kpiId: string, actorName: string, actorRole: UserRole) => {
    setKpis((prev) =>
      prev.map((k) => (k.id === kpiId ? { ...k, status: 'APPROVED' } : k))
    );
    logAuditAction(
      actorName,
      actorRole,
      'APPROVE',
      'individual_kpis',
      kpiId,
      `Persetujuan target sasaran KPI ${kpiId} disahkan oleh atasan.`
    );
  };

  const updateKPIActual = (kpiId: string, actualValue: number) => {
    setKpis((prev) =>
      prev.map((k) => {
        if (k.id === kpiId) {
          const achievementPercentage = Number(
            ((actualValue / k.targetValue) * 100).toFixed(1)
          );
          return { ...k, actualValue, achievementPercentage };
        }
        return k;
      })
    );
  };

  const submitPeerReview = (review: Omit<PeerReview360, 'id' | 'submittedAt'>) => {
    const newReview: PeerReview360 = {
      ...review,
      id: `rev-${Date.now()}`,
      submittedAt: new Date().toISOString(),
    };
    setPeerReviews((prev) => [newReview, ...prev]);
    logAuditAction(
      review.evaluatorName,
      'EMPLOYEE',
      'CREATE',
      'peer_reviews_360',
      newReview.id,
      `Evaluasi 360° terenkripsi untuk ${review.evaluateeId} berhasil disubmit secara anonim.`
    );
  };

  const convertProbation = (onboardingId: string, actorName: string) => {
    setOnboardingList((prev) =>
      prev.map((item) =>
        item.id === onboardingId
          ? {
              ...item,
              probationPassed: true,
              conversionDate: new Date().toISOString().split('T')[0],
            }
          : item
      )
    );
    logAuditAction(
      actorName,
      'HR_MANAGER',
      'CALIBRATE',
      'onboarding_milestones',
      onboardingId,
      `Pengangkatan status karyawan tetap (PKWTT) setelah kelulusan masa percobaan 90 hari.`
    );
  };

  const verifyHandoverItem = (handoverId: string, verifierName: string) => {
    setKnowledgeHandovers((prev) =>
      prev.map((item) =>
        item.id === handoverId
          ? {
              ...item,
              isVerified: true,
              verifiedBy: verifierName,
              verifiedAt: new Date().toISOString(),
            }
          : item
      )
    );
    logAuditAction(
      verifierName,
      'PEOPLE_MANAGER',
      'APPROVE',
      'knowledge_handovers',
      handoverId,
      `Verifikasi serah terima aset/pengetahuan disahkan.`
    );
  };

  const disburseSeverancePayment = (severanceId: string, actorName: string) => {
    setSeveranceRecord((prev) => ({
      ...prev,
      isPaid: true,
      paymentReferenceNo: `TRX-DISB-${Date.now().toString().slice(-6)}`,
      paidAt: new Date().toISOString(),
    }));
    logAuditAction(
      actorName,
      'HR_MANAGER',
      'DISBURSE',
      'severance_calculations',
      severanceId,
      `Pencairan hak pesangon PP 35/2021 telah ditransfer via Host-to-Host perbankan.`
    );
  };

  const recalculateBudiGPA = (
    kpi: number,
    sop: number,
    comp: number,
    val: number,
    pot?: number
  ) => {
    const res = calculateCompositeGPA({
      kpiScore: kpi,
      sopScore: sop,
      competencyScore: comp,
      coreValuesScore: val,
      potentialScore: pot ?? appraisalBudi.potentialScore,
    });

    setAppraisalBudi((prev) => ({
      ...prev,
      kpiScore: kpi,
      sopScore: sop,
      competencyScore: comp,
      coreValuesScore: val,
      totalPercentage: res.totalPercentage,
      compositeGPA: res.compositeGPA,
      rating: res.rating,
      nineBoxQuadrant: res.nineBoxQuadrant,
    }));
  };

  return (
    <AppContext.Provider
      value={{
        employees,
        kpis,
        appraisalBudi,
        sopLogs,
        peerReviews,
        manpowerPlans,
        recruitmentList,
        onboardingList,
        offboardingRequests,
        knowledgeHandovers,
        severanceRecord,
        lifetimeContributions,
        strategicPillars,
        auditLogs,
        approveKPI,
        updateKPIActual,
        submitPeerReview,
        convertProbation,
        verifyHandoverItem,
        disburseSeverancePayment,
        recalculateBudiGPA,
        logAuditAction,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
