import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';
import { assertCan, can } from '@/lib/auth/rbac';
import { resolveVisibleEmployeeIds, assertEmployeeVisible } from '@/lib/auth/scope';
import { NotFoundError, ImmutableRecordError, BusinessRuleError } from '@/lib/auth/errors';
import { calculateCompositeGPA } from '@/lib/engines/gpa-engine';
import {
  selectAppraisalByEmployee,
  selectAppraisalById,
  upsertPerformanceAppraisal,
  setAppraisalCalibrated,
} from '@/lib/repositories/appraisalRepository';
import { logAction } from './auditService';
import { deriveKpiScore } from './kpiScoreDerivationService';

export interface CalculateGPAInput {
  periodId: string;
  employeeId: string;
  /** Bila dihilangkan, skor KPI diturunkan dari `individual_kpis` periode ini. */
  kpiScore?: number;
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

/**
 * Ambil periode penilaian yang sedang ACTIVE; bila belum ada, buat periode
 * untuk kuartal berjalan secara idempoten. Dipakai saat onboarding karyawan
 * baru agar KPI pembuka langsung tertaut ke periode penilaian yang sah.
 */
export async function ensureActiveAppraisalPeriod(db: Db) {
  const existing = (await db.execute(sql`
    SELECT id, period_code AS "periodCode", start_date AS "startDate", end_date AS "endDate", status
      FROM appraisal_periods
     WHERE status = 'ACTIVE'::period_status_enum
     ORDER BY start_date DESC
     LIMIT 1
  `)) as unknown as { rows: any[] };
  if (existing.rows[0]) return existing.rows[0];

  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  const periodCode = `${year}-Q${quarter}`;
  const startMonth = (quarter - 1) * 3;
  const startDate = new Date(Date.UTC(year, startMonth, 1));
  const endDate = new Date(Date.UTC(year, startMonth + 3, 0));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const created = (await db.execute(sql`
    INSERT INTO appraisal_periods (period_code, start_date, end_date, status)
    VALUES (${periodCode}, ${fmt(startDate)}::date, ${fmt(endDate)}::date, 'ACTIVE'::period_status_enum)
    ON CONFLICT (period_code) DO UPDATE SET status = 'ACTIVE'::period_status_enum
    RETURNING id, period_code AS "periodCode", start_date AS "startDate", end_date AS "endDate", status
  `)) as unknown as { rows: any[] };
  return created.rows[0];
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
      `Nilai penilaian karyawan ${input.employeeId} pada periode ${input.periodId} telah disahkan dan berstatus immutable.`
    );
  }

  const kpiDerived = await deriveKpiScore(db, input.employeeId, input.periodId);
  const kpiScore = input.kpiScore ?? kpiDerived.value;
  if (kpiScore === null) {
    throw new BusinessRuleError(
      `Skor KPI karyawan ${input.employeeId} pada periode ${input.periodId} belum bisa dihitung: belum ada KPI dengan target yang terisi. Lengkapi KPI karyawan atau isi kpi_actual_score secara manual.`
    );
  }

  const result = calculateCompositeGPA({
    kpiScore,
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
      kpiCompositeScore: kpiScore,
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
    description: `Kalkulasi Composite GPA (${result.compositeGPA}) dan 9-Box Grid (${result.nineBoxQuadrant}) — skor KPI ${kpiScore.toFixed(2)} (${input.kpiScore === undefined ? 'diturunkan dari KPI' : 'input manual'})`,
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
      `Nilai penilaian ID '${appraisalId}' telah disahkan oleh Komite Kalibrasi dan berstatus immutable.`
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
