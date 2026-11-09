import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';
import { assertCan, can } from '@/lib/auth/rbac';
import { resolveVisibleEmployeeIds, assertEmployeeVisible } from '@/lib/auth/scope';
import { BusinessRuleError } from '@/lib/auth/errors';
import { calculateCompositeGPA } from '@/lib/engines/gpa-engine';
import {
  selectAppraisalByEmployee,
  upsertPerformanceAppraisal,
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
  /**
   * `true` (default): simpan sekaligus mengesahkan/mengunci nilai. Hanya untuk
   * pemegang `appraisal:calibrate`.
   * `false`: simpan hasil kalkulasi saja, nilai tetap BELUM terkunci
   * (`is_calibrated = false`) — alur evaluasi kinerja manajer.
   */
  approve?: boolean;
}

export async function getAppraisalByEmployee(db: Db, employeeId: string, periodId: string) {
  return selectAppraisalByEmployee(db, employeeId, periodId);
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

  const finalSaved = await upsertPerformanceAppraisal(
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
    true
  );
  await logAction(db, {
    userId: session.userId,
    actionType: 'UPDATE',
    entityName: 'performance_appraisals',
    recordId: finalSaved.id,
    oldData: existing,
    newData: finalSaved,
    description: `Kalkulasi Composite GPA (${result.compositeGPA}) dan 9-Box Grid (${result.nineBoxQuadrant}) — skor KPI ${kpiScore.toFixed(2)} (${input.kpiScore === undefined ? 'diturunkan dari KPI' : 'input manual'})`,
  });

  return finalSaved;
}

