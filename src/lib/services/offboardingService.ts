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
  advanceOffboardingStatus,
  deactivateEmployeeOnExit,
  deactivateUserAccount,
  getClearanceStatus,
  enterPostPhase,
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

  try {
    const { notifyEmployeeLifecycle } = await import('./notificationService');
    await notifyEmployeeLifecycle(db, {
      employeeId: data.employeeId,
      eventType: 'OFFBOARDING_INITIATED',
      title: 'Proses Offboarding Dimulai',
      body: `Proses offboarding Anda telah dimulai dengan hari kerja terakhir ${data.lastWorkingDay}. ` +
        `Mohon lengkapi checklist serah terima (handover) melalui portal karyawan.`,
    });
  } catch { /* best-effort */ }

  // Inisiasi offboarding memindahkan karyawan ke fase Pasca-Kerja (state machine).
  await enterPostPhase(
    db,
    data.employeeId,
    `Offboarding diinisiasi (hari kerja terakhir ${data.lastWorkingDay}).`
  );

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

  // State machine: begitu ada item serah terima yang diverifikasi, request
  // masuk fase CLEARANCE_IN_PROGRESS (monotonik, tidak akan mundur).
  if (updated?.offboardingRequestId) {
    await advanceOffboardingStatus(db, updated.offboardingRequestId, 'CLEARANCE_IN_PROGRESS');
  }

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
  const clearance = await getClearanceStatus(db, offboardingRequestId);
  if (!clearance.allVerified) {
    throw new BusinessRuleError(
      `Kalkulasi pesangon & surat clearance ditolak: Terdapat ${clearance.unverifiedCount} item serah terima yang belum terverifikasi.`
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

  const totalAmount = Number(record?.totalDisbursement ?? calcResult.totalDisbursement ?? 0);

  return {
    ...record,
    serviceYears: Number(record?.serviceYears ?? serviceYears),
    baseSalary: Number(record?.baseSalary ?? baseSalary),
    severancePay: Number(record?.severancePay ?? calcResult.severancePay),
    serviceAppreciationPay: Number(record?.serviceAppreciationPay ?? calcResult.serviceAppreciationPay),
    compensationPay: Number(record?.compensationPay ?? calcResult.compensationPay),
    dplkTopup: Number(record?.dplkTopup ?? dplkTopup),
    totalDisbursement: totalAmount,
    totalDisbursementIdr: totalAmount,
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

  // Setelah pesangon cair dan clearance 100%, tuntasikan lifecycle:
  // offboarding → COMPLETED, karyawan dinonaktifkan (RESIGNED/RETIRED), akun login dimatikan.
  let completion: {
    offboardingStatus: string | null;
    employeeDeactivated: boolean;
    exitStatus: 'RESIGNED' | 'RETIRED' | null;
  } = { offboardingStatus: null, employeeDeactivated: false, exitStatus: null };

  const requestId = paid?.offboardingRequestId as string | undefined;
  if (requestId) {
    const offboarding = await selectOffboardingById(db, requestId);
    const clearance = await getClearanceStatus(db, requestId);

    if (offboarding && clearance.allVerified) {
      await advanceOffboardingStatus(db, requestId, 'COMPLETED');

      const reason = String(offboarding.reasonForLeaving || '').toLowerCase();
      const exitStatus: 'RESIGNED' | 'RETIRED' =
        reason.includes('pensiun') || reason.includes('pension') ? 'RETIRED' : 'RESIGNED';

      const deactivated = await deactivateEmployeeOnExit(
        db,
        offboarding.employeeId,
        exitStatus,
        offboarding.lastWorkingDay
      );
      if (deactivated) {
        await deactivateUserAccount(db, offboarding.employeeId);
        await enterPostPhase(
          db,
          offboarding.employeeId,
          `Offboarding tuntas: karyawan dinonaktifkan (${exitStatus}).`
        );
        await logAction(db, {
          userId: session.userId,
          actionType: 'UPDATE',
          entityName: 'employees',
          recordId: offboarding.employeeId,
          newData: deactivated,
          description: `Offboarding tuntas: karyawan ${offboarding.employeeName ?? offboarding.employeeId} dinonaktifkan (${exitStatus}) & akun login dimatikan.`,
        });
      }

      completion = {
        offboardingStatus: 'COMPLETED',
        employeeDeactivated: Boolean(deactivated),
        exitStatus,
      };
    }
  }

  await logAction(db, {
    userId: session.userId,
    actionType: 'DISBURSE',
    entityName: 'severance_calculations',
    recordId: severanceId,
    newData: paid,
    description: `Pencairan dana hak pesangon berhasil ditransfer dengan referensi: ${paymentRef}`,
  });

  // Notifikasi akhir siklus hidup: pesangon dibayarkan + status keluar.
  try {
    let targetEmployee: string | undefined = (paid as any)?.employeeId;
    if (!targetEmployee && paid?.offboardingRequestId) {
      const off = await selectOffboardingById(db, String(paid.offboardingRequestId));
      targetEmployee = off?.employeeId;
    }
    if (targetEmployee) {
      const { notifyEmployeeLifecycle } = await import('./notificationService');
      await notifyEmployeeLifecycle(db, {
        employeeId: targetEmployee,
        eventType: 'SEVERANCE_PAID',
        title: 'Hak Pesangon Telah Dicairkan',
        body: `Hak pesangon Anda telah ditransfer dengan referensi ${paymentRef}. ` +
          `Terima kasih atas kontribusi Anda selama bergabung bersama kami.`,
      });
    }
  } catch { /* best-effort */ }

  return { ...paid, completion };
}

export async function getLegacyVault(db: Db, employeeId: string) {
  return selectLifetimeContributions(db, employeeId);
}
