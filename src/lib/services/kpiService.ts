import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';
import { assertCan } from '@/lib/auth/rbac';
import { resolveVisibleEmployeeIds, assertEmployeeVisible } from '@/lib/auth/scope';
import { BusinessRuleError, NotFoundError, ForbiddenError } from '@/lib/auth/errors';
import {
  selectKpisByEmployee,
  selectKpiById,
  calculateTotalWeight,
  verifyPillarExists,
  verifyDivisionKpiExists,
  insertIndividualKpi,
  updateKpiActual,
  updateKpiStatus,
  CreateKpiInput,
} from '@/lib/repositories/kpiRepository';
import { logAction } from './auditService';

export async function getEmployeeKpis(
  db: Db,
  session: SessionPayload,
  employeeId: string,
  periodId?: string
) {
  assertCan(session, 'kpi:read');
  const scope = await resolveVisibleEmployeeIds(db, session);
  assertEmployeeVisible(scope, employeeId);

  return selectKpisByEmployee(db, employeeId, periodId);
}

export async function submitIndividualKpi(
  db: Db,
  session: SessionPayload,
  data: CreateKpiInput
) {
  assertCan(session, 'kpi:write');
  const scope = await resolveVisibleEmployeeIds(db, session);
  assertEmployeeVisible(scope, data.employeeId);

  if (data.targetValue <= 0) {
    throw new BusinessRuleError('Target value KPI wajib lebih besar dari 0.');
  }

  if (data.kpiWeight <= 0 || data.kpiWeight > 100) {
    throw new BusinessRuleError('Bobot KPI harus antara 1% sampai 100%.');
  }

  // PRD §8 — 100% KPI tervalidasi tautannya
  if (!data.strategicPillarId) {
    throw new BusinessRuleError('KPI individu wajib terhubung ke minimal satu Pilar Strategis Korporasi (PRD §8).');
  }

  const pillarExists = await verifyPillarExists(db, data.strategicPillarId);
  if (!pillarExists) {
    throw new BusinessRuleError(`Pilar Strategis ID '${data.strategicPillarId}' tidak valid atau tidak ditemukan.`);
  }

  if (data.divisionKpiId) {
    const divExists = await verifyDivisionKpiExists(db, data.divisionKpiId);
    if (!divExists) {
      throw new BusinessRuleError(`Division KPI ID '${data.divisionKpiId}' tidak valid atau tidak ditemukan.`);
    }
  }

  const currentTotal = await calculateTotalWeight(db, data.employeeId, data.periodId);
  if (currentTotal + data.kpiWeight > 100) {
    throw new BusinessRuleError(
      `Total bobot KPI melebihi 100%. Saat ini ${currentTotal}%, penambahan ${data.kpiWeight}% menghasilkan ${currentTotal + data.kpiWeight}%.`
    );
  }

  const created = await insertIndividualKpi(db, data);

  await logAction(db, {
    userId: session.userId,
    actionType: 'CREATE',
    entityName: 'individual_kpis',
    recordId: created.id,
    newData: created,
    description: `Pembuatan sasaran kerja SMART: '${data.kpiTitle}' (bobot ${data.kpiWeight}%)`,
  });

  return created;
}

export async function updateKpiActualValue(
  db: Db,
  session: SessionPayload,
  kpiId: string,
  actualValue: number
) {
  if (actualValue < 0) {
    throw new BusinessRuleError('Nilai realisasi (actual value) tidak boleh bernilai negatif.');
  }

  const kpi = await selectKpiById(db, kpiId);
  if (!kpi) {
    throw new NotFoundError(`KPI dengan ID '${kpiId}' tidak ditemukan.`);
  }

  const scope = await resolveVisibleEmployeeIds(db, session);
  assertEmployeeVisible(scope, kpi.employeeId);

  const updated = await updateKpiActual(db, kpiId, actualValue);

  await logAction(db, {
    userId: session.userId,
    actionType: 'UPDATE',
    entityName: 'individual_kpis',
    recordId: kpiId,
    oldData: { actualValue: kpi.actualValue, achievementPercentage: kpi.achievementPercentage },
    newData: { actualValue: updated.actualValue, achievementPercentage: updated.achievementPercentage },
    description: `Update realisasi KPI '${kpi.kpiTitle}' menjadi ${actualValue}`,
  });

  return updated;
}

export async function approveKpi(
  db: Db,
  session: SessionPayload,
  kpiId: string
) {
  assertCan(session, 'kpi:approve');

  const kpi = await selectKpiById(db, kpiId);
  if (!kpi) {
    throw new NotFoundError(`KPI dengan ID '${kpiId}' tidak ditemukan.`);
  }

  // Employee cannot approve their own KPI
  if (session.employeeId === kpi.employeeId && session.role === 'EMPLOYEE') {
    throw new ForbiddenError('Karyawan tidak memiliki wewenang untuk menyetujui KPI miliknya sendiri.');
  }

  const scope = await resolveVisibleEmployeeIds(db, session);
  assertEmployeeVisible(scope, kpi.employeeId);

  const approved = await updateKpiStatus(db, kpiId, 'APPROVED', session.userId);

  await logAction(db, {
    userId: session.userId,
    actionType: 'APPROVE',
    entityName: 'individual_kpis',
    recordId: kpiId,
    oldData: { status: kpi.status },
    newData: { status: 'APPROVED' },
    description: `Persetujuan sasaran kerja KPI '${kpi.kpiTitle}' disahkan oleh ${session.email}`,
  });

  return approved;
}
