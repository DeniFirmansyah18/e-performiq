import type { Db } from '@/lib/db/client';
import { sql } from 'drizzle-orm';
import { MAX_INDIKATOR } from './kpiGovernanceConstants';
import type { SessionPayload } from '@/lib/auth/session';
import { assertCan } from '@/lib/auth/rbac';
import { resolveVisibleEmployeeIds, assertEmployeeVisible } from '@/lib/auth/scope';
import { BusinessRuleError, NotFoundError } from '@/lib/auth/errors';
import { selectKpiById } from '@/lib/repositories/kpiRepository';
import {
  selectIndicatorsByKpi,
  selectIndicatorsByEmployee,
  selectIndicatorById,
  sumActiveIndicatorWeight,
  insertIndicator,
  updateIndicator,
  deleteIndicator,
  type CreateIndicatorInput,
  type UpdateIndicatorInput,
} from '@/lib/repositories/kpiIndicatorRepository';
import { logAction } from './auditService';

async function loadKpiInScope(db: Db, session: SessionPayload, kpiId: string) {
  const kpi = await selectKpiById(db, kpiId);
  if (!kpi) throw new NotFoundError(`KPI dengan ID '${kpiId}' tidak ditemukan.`);
  const scope = await resolveVisibleEmployeeIds(db, session);
  assertEmployeeVisible(scope, kpi.employeeId);
  return kpi;
}

export async function listIndicatorsForKpi(db: Db, session: SessionPayload, kpiId: string) {
  assertCan(session, 'kpi:read');
  await loadKpiInScope(db, session, kpiId);
  return selectIndicatorsByKpi(db, kpiId);
}

export async function listIndicatorsForEmployee(
  db: Db,
  session: SessionPayload,
  employeeId: string,
  periodId?: string,
) {
  assertCan(session, 'kpi:read');
  const scope = await resolveVisibleEmployeeIds(db, session);
  assertEmployeeVisible(scope, employeeId);
  return selectIndicatorsByEmployee(db, employeeId, periodId);
}

export async function createIndicator(db: Db, session: SessionPayload, data: CreateIndicatorInput) {
  assertCan(session, 'kpi:write');
  const kpi = await loadKpiInScope(db, session, data.kpiId);

  if (!Number.isFinite(data.targetValue) || data.targetValue <= 0) {
    throw new BusinessRuleError('Target indikator harus lebih besar dari 0.');
  }
  const weight = data.indicatorWeight ?? 100;
  if (!Number.isFinite(weight) || weight <= 0 || weight > 100) {
    throw new BusinessRuleError('Bobot indikator harus antara 1% sampai 100%.');
  }

  const existingTotal = await sumActiveIndicatorWeight(db, data.kpiId);
  if (existingTotal + weight > 100) {
    throw new BusinessRuleError(
      `Total bobot indikator melebihi 100%. Indikator aktif saat ini ${existingTotal}%, penambahan ${weight}% menghasilkan ${existingTotal + weight}%.`,
    );
  }

  // Batas jumlah indikator per KPI: maksimal 5 (praktik KPI 3–5 indikator).
  // Dibatasi agar fokus kerja terjaga dan penilaian tetap terukur.
  {
    const hitung = (await db.execute(sql`
      SELECT count(*)::int AS n FROM kpi_indicators
       WHERE kpi_id = ${data.kpiId}::uuid AND is_active = TRUE
    `)) as unknown as { rows: Array<{ n: number }> };
    const jumlahSekarang = Number(hitung.rows?.[0]?.n ?? 0);
    if (jumlahSekarang >= MAX_INDIKATOR) {
      throw new BusinessRuleError(
        `Jumlah indikator maksimal ${MAX_INDIKATOR} per KPI (saat ini ${jumlahSekarang}). Ringkas indikator agar fokus kerja tetap terjaga.`,
      );
    }
  }

  const created = await insertIndicator(db, { ...data, indicatorWeight: weight });

  await logAction(db, {
    userId: session.userId,
    actionType: 'CREATE',
    entityName: 'kpi_indicators',
    recordId: created.id,
    newData: created,
    description: `Penetapan indikator harian '${data.indicatorName}' pada KPI '${kpi.kpiTitle}' (bobot ${weight}%)`,
  });

  return created;
}

export async function patchIndicator(
  db: Db,
  session: SessionPayload,
  indicatorId: string,
  data: UpdateIndicatorInput,
) {
  assertCan(session, 'kpi:write');
  const current = await selectIndicatorById(db, indicatorId);
  if (!current) throw new NotFoundError(`Indikator dengan ID '${indicatorId}' tidak ditemukan.`);
  await loadKpiInScope(db, session, current.kpiId);

  if (data.targetValue !== undefined && (!Number.isFinite(data.targetValue) || data.targetValue <= 0)) {
    throw new BusinessRuleError('Target indikator harus lebih besar dari 0.');
  }
  if (data.indicatorWeight !== undefined) {
    if (!Number.isFinite(data.indicatorWeight) || data.indicatorWeight <= 0 || data.indicatorWeight > 100) {
      throw new BusinessRuleError('Bobot indikator harus antara 1% sampai 100%.');
    }
    // Hanya bobot aktif yang dihitung; indikator yang dinonaktifkan tidak menambah.
    const stillActive = data.isActive ?? current.isActive;
    if (stillActive) {
      const otherTotal = await sumActiveIndicatorWeight(db, current.kpiId, indicatorId);
      if (otherTotal + data.indicatorWeight > 100) {
        throw new BusinessRuleError(
          `Total bobot indikator melebihi 100%. Indikator lain ${otherTotal}%, bobot baru ${data.indicatorWeight}% menghasilkan ${otherTotal + data.indicatorWeight}%.`,
        );
      }
    }
  }

  const updated = await updateIndicator(db, indicatorId, data);
  if (!updated) throw new NotFoundError(`Indikator dengan ID '${indicatorId}' tidak ditemukan.`);

  await logAction(db, {
    userId: session.userId,
    actionType: 'UPDATE',
    entityName: 'kpi_indicators',
    recordId: indicatorId,
    oldData: current,
    newData: updated,
    description: `Perubahan indikator harian '${updated.indicatorName}'`,
  });

  return updated;
}

export async function removeIndicator(db: Db, session: SessionPayload, indicatorId: string) {
  assertCan(session, 'kpi:write');
  const current = await selectIndicatorById(db, indicatorId);
  if (!current) throw new NotFoundError(`Indikator dengan ID '${indicatorId}' tidak ditemukan.`);
  await loadKpiInScope(db, session, current.kpiId);

  const deleted = await deleteIndicator(db, indicatorId);

  await logAction(db, {
    userId: session.userId,
    actionType: 'DELETE',
    entityName: 'kpi_indicators',
    recordId: indicatorId,
    oldData: current,
    description: `Penghapusan indikator harian '${current.indicatorName}'`,
  });

  return deleted;
}
