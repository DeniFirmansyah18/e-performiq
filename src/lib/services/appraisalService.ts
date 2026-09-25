import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';
import { assertCan, can } from '@/lib/auth/rbac';
import { resolveVisibleEmployeeIds, assertEmployeeVisible } from '@/lib/auth/scope';
import { NotFoundError, ImmutableRecordError } from '@/lib/auth/errors';
import { calculateCompositeGPA } from '@/lib/engines/gpa-engine';
import {
  selectAppraisalByEmployee,
  selectAppraisalById,
  upsertPerformanceAppraisal,
  setAppraisalCalibrated,
} from '@/lib/repositories/appraisalRepository';
import { logAction } from './auditService';

export interface CalculateGPAInput {
  periodId: string;
  employeeId: string;
  kpiScore: number;
  sopScore: number;
  competencyScore: number;
  coreValuesScore: number;
  potentialScore?: number;
  notes?: string;
}

export async function getAppraisalByEmployee(db: Db, employeeId: string, periodId: string) {
  return selectAppraisalByEmployee(db, employeeId, periodId);
}

export async function getAppraisalById(db: Db, id: string) {
  return selectAppraisalById(db, id);
}

export async function calculateAndSaveGPA(
  db: Db,
  session: SessionPayload,
  input: CalculateGPAInput
) {
  assertCan(session, 'appraisal:calculate');
  const scope = await resolveVisibleEmployeeIds(db, session);
  assertEmployeeVisible(scope, input.employeeId);

  const existing = await selectAppraisalByEmployee(db, input.employeeId, input.periodId);
  const isAuthorizedCalibrator = can(session.role, 'appraisal:calibrate');
  if (existing?.isCalibrated && !isAuthorizedCalibrator) {
    throw new ImmutableRecordError(
      `Nilai penilaian karyawan ${input.employeeId} pada periode ${input.periodId} telah disahkan dan berstatus immutable (PRD §6.2).`
    );
  }

  const result = calculateCompositeGPA({
    kpiScore: input.kpiScore,
    sopScore: input.sopScore,
    competencyScore: input.competencyScore,
    coreValuesScore: input.coreValuesScore,
    potentialScore: input.potentialScore ?? 3.5,
  });

  const saved = await upsertPerformanceAppraisal(
    db,
    {
      periodId: input.periodId,
      employeeId: input.employeeId,
      kpiCompositeScore: input.kpiScore,
      sopComplianceScore: input.sopScore,
      competencyScore: input.competencyScore,
      coreValuesScore: input.coreValuesScore,
      totalPercentageScore: result.totalPercentage,
      compositeGPA: result.compositeGPA,
      performanceRating: result.rating,
      potentialScore: input.potentialScore ?? 3.5,
      nineBoxQuadrant: result.nineBoxQuadrant,
    },
    isAuthorizedCalibrator
  );

  let finalSaved = saved;
  if (isAuthorizedCalibrator) {
    finalSaved = await setAppraisalCalibrated(
      db,
      saved.id,
      session.userId,
      input.notes ?? existing?.calibrationNotes ?? 'Dimoderasi oleh Komite Penilai'
    );
  }

  await logAction(db, {
    userId: session.userId,
    actionType: 'CALIBRATE',
    entityName: 'performance_appraisals',
    recordId: finalSaved.id,
    oldData: existing,
    newData: finalSaved,
    description: `Kalkulasi Composite GPA (${result.compositeGPA}) dan 9-Box Grid (${result.nineBoxQuadrant})`,
  });

  return finalSaved;
}

export async function calibrateAppraisal(
  db: Db,
  session: SessionPayload,
  appraisalId: string,
  notes?: string
) {
  assertCan(session, 'appraisal:calibrate');

  const appraisal = await selectAppraisalById(db, appraisalId);
  if (!appraisal) {
    throw new NotFoundError(`Appraisal dengan ID '${appraisalId}' tidak ditemukan.`);
  }

  if (appraisal.isCalibrated) {
    throw new ImmutableRecordError(
      `Nilai penilaian ID '${appraisalId}' telah disahkan oleh Komite Kalibrasi dan berstatus immutable (PRD §6.2).`
    );
  }

  const calibrated = await setAppraisalCalibrated(db, appraisalId, session.userId, notes);

  await logAction(db, {
    userId: session.userId,
    actionType: 'CALIBRATE',
    entityName: 'performance_appraisals',
    recordId: appraisalId,
    oldData: appraisal,
    newData: calibrated,
    description: `Pengesahan nilai akhir oleh Komite Kalibrasi: ${notes ?? 'Disahkan'}`,
  });

  return calibrated;
}
