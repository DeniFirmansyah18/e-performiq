import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';
import { BusinessRuleError, NotFoundError } from '@/lib/auth/errors';
import { calculateSeverance, calculateServiceYears } from '@/lib/engines/severance-engine';
import {
  insertOffboardingRequest,
  selectOffboardingRequests,
  selectOffboardingById,
  selectHandoversByRequest,
  updateHandoverVerification,
  upsertSeveranceRecord,
  markSeverancePaid,
  selectLifetimeContributions,
} from '@/lib/repositories/offboardingRepository';
import { logAction } from './auditService';

export async function createOffboardingRequest(
  db: Db,
  session: SessionPayload,
  data: {
    employeeId: string;
    reasonForLeaving: string;
    resignationNoticeDate: string;
    lastWorkingDay: string;
    isRegrettableAttrition?: boolean;
  }
) {
  if (!['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'].includes(session.role)) {
    throw new BusinessRuleError('Tidak memiliki wewenang untuk mengajukan offboarding.');
  }

  const created = await insertOffboardingRequest(db, data);

  await logAction(db, {
    userId: session.userId,
    actionType: 'CREATE',
    entityName: 'offboarding_requests',
    recordId: created.id,
    newData: created,
    description: `Inisiasi offboarding & checklist clearance untuk karyawan ID: ${data.employeeId}`,
  });

  return created;
}

export async function getOffboardingList(db: Db) {
  const requests = await selectOffboardingRequests(db);
  const detailed = await Promise.all(
    requests.map(async (req) => {
      const handovers = await selectHandoversByRequest(db, req.id);
      const verifiedCount = handovers.filter((h) => h.isVerified).length;
      const progress = handovers.length > 0
        ? Math.round((verifiedCount / handovers.length) * 100)
        : 100;
      return {
        ...req,
        handovers,
        handoverProgress: progress,
      };
    })
  );
  return detailed;
}

export async function verifyHandoverItem(
  db: Db,
  session: SessionPayload,
  handoverId: string
) {
  if (!['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER'].includes(session.role)) {
    throw new BusinessRuleError('Hanya Manager atau HR yang dapat memverifikasi serah terima aset.');
  }

  const updated = await updateHandoverVerification(
    db,
    handoverId,
    session.employeeId || session.userId
  );

  await logAction(db, {
    userId: session.userId,
    actionType: 'APPROVE',
    entityName: 'knowledge_handovers',
    recordId: handoverId,
    newData: updated,
    description: `Verifikasi serah terima aset/pengetahuan disahkan oleh ${session.email}`,
  });

  return updated;
}

export async function calculateOffboardingSeverance(
  db: Db,
  session: SessionPayload,
  offboardingRequestId: string,
  reasonType: 'RESIGNATION' | 'PENSION' | 'EFFICIENCY' | 'CONTRACT_END' = 'RESIGNATION',
  dplkTopup = 0
) {
  if (!['SUPER_ADMIN', 'HR_MANAGER'].includes(session.role)) {
    throw new BusinessRuleError('Hanya HR_MANAGER atau SUPER_ADMIN yang berwenang menghitung hak pesangon.');
  }

  const offboarding = await selectOffboardingById(db, offboardingRequestId);
  if (!offboarding) {
    throw new NotFoundError(`Data offboarding dengan ID '${offboardingRequestId}' tidak ditemukan.`);
  }

  // --- PRD §8 Acceptance Criteria (HARD GATE): Clearance Check ---
  // "Surat bebas kewajiban dan kalkulasi pesangon/DPLK tidak dapat dicetak/disahkan jika checklist serah terima aset/pengetahuan belum berstatus Completed."
  const handovers = await selectHandoversByRequest(db, offboardingRequestId);
  const unverified = handovers.filter((h) => !h.isVerified);
  if (unverified.length > 0) {
    throw new BusinessRuleError(
      `Kalkulasi pesangon & surat clearance ditolak: Terdapat ${unverified.length} item serah terima yang belum terverifikasi (PRD §8 Acceptance Criteria).`
    );
  }

  const serviceYears = calculateServiceYears(offboarding.joinDate, offboarding.lastWorkingDay);
  const baseSalary = Number(offboarding.baseSalary);

  const calcResult = calculateSeverance({
    serviceYears,
    baseSalary,
    reasonType,
    dplkTopup,
  });

  const record = await upsertSeveranceRecord(db, {
    offboardingRequestId,
    serviceYears,
    baseSalary,
    severancePay: calcResult.severancePay,
    serviceAppreciationPay: calcResult.serviceAppreciationPay,
    compensationPay: calcResult.compensationPay,
    dplkTopupAmount: dplkTopup,
    totalDisbursement: calcResult.totalDisbursement,
    slaDisbursedDays: 3,
  });

  await logAction(db, {
    userId: session.userId,
    actionType: 'CALIBRATE',
    entityName: 'severance_calculations',
    recordId: record.id,
    newData: record,
    description: `Kalkulasi hak pesangon PP 35/2021 (${calcResult.legalReference}) total: IDR ${calcResult.totalDisbursement}`,
  });

  return {
    ...record,
    breakdown: calcResult,
  };
}

export async function disburseSeverance(
  db: Db,
  session: SessionPayload,
  severanceId: string
) {
  if (!['SUPER_ADMIN', 'HR_MANAGER'].includes(session.role)) {
    throw new BusinessRuleError('Hanya HR_MANAGER yang berwenang mencairkan pesangon.');
  }

  const paymentRef = `TRX-DISB-${Date.now().toString().slice(-6)}`;
  const paid = await markSeverancePaid(db, severanceId, paymentRef);

  await logAction(db, {
    userId: session.userId,
    actionType: 'DISBURSE',
    entityName: 'severance_calculations',
    recordId: severanceId,
    newData: paid,
    description: `Pencairan dana hak pesangon berhasil ditransfer dengan referensi: ${paymentRef}`,
  });

  return paid;
}

export async function getLegacyVault(db: Db, employeeId: string) {
  return selectLifetimeContributions(db, employeeId);
}
