import { sql } from 'drizzle-orm';
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
  updateKpiWeight as updateKpiWeightRepo,
  deleteIndividualKpi as deleteIndividualKpiRepo,
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
    throw new BusinessRuleError('KPI individu wajib terhubung ke minimal satu Pilar Strategis Korporasi.');
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

  // Menyetujui KPI adalah menilai orang lain, jadi berlaku untuk SEMUA peran:
  // HR dan People Manager pun tidak boleh menyetujui KPI miliknya sendiri.
  if (session.employeeId && session.employeeId === kpi.employeeId) {
    throw new ForbiddenError('Anda tidak dapat menyetujui KPI milik sendiri.');
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

export async function updateKpiWeight(
  db: Db,
  session: SessionPayload,
  kpiId: string,
  newWeight: number
) {
  assertCan(session, 'kpi:write');
  if (newWeight <= 0 || newWeight > 100) {
    throw new BusinessRuleError('Bobot KPI harus antara 1% sampai 100%.');
  }

  const kpi = await selectKpiById(db, kpiId);
  if (!kpi) {
    throw new NotFoundError(`KPI dengan ID '${kpiId}' tidak ditemukan.`);
  }

  const scope = await resolveVisibleEmployeeIds(db, session);
  assertEmployeeVisible(scope, kpi.employeeId);

  const otherTotal = await calculateTotalWeight(db, kpi.employeeId, kpi.periodId, kpiId);
  if (otherTotal + newWeight > 100) {
    throw new BusinessRuleError(
      `Total bobot KPI melebihi 100%. Bobot KPI lain saat ini ${otherTotal}%, bobot baru ${newWeight}% menghasilkan ${otherTotal + newWeight}%.`
    );
  }

  const updated = await updateKpiWeightRepo(db, kpiId, newWeight);

  await logAction(db, {
    userId: session.userId,
    actionType: 'UPDATE',
    entityName: 'individual_kpis',
    recordId: kpiId,
    oldData: { kpiWeight: kpi.kpiWeight },
    newData: { kpiWeight: newWeight },
    description: `Penyesuaian bobot KPI '${kpi.kpiTitle}' dari ${kpi.kpiWeight}% menjadi ${newWeight}%`,
  });

  return updated;
}

export async function removeIndividualKpi(
  db: Db,
  session: SessionPayload,
  kpiId: string
) {
  assertCan(session, 'kpi:write');

  const kpi = await selectKpiById(db, kpiId);
  if (!kpi) {
    throw new NotFoundError(`KPI dengan ID '${kpiId}' tidak ditemukan.`);
  }

  const scope = await resolveVisibleEmployeeIds(db, session);
  assertEmployeeVisible(scope, kpi.employeeId);

  const deleted = await deleteIndividualKpiRepo(db, kpiId);

  await logAction(db, {
    userId: session.userId,
    actionType: 'DELETE',
    entityName: 'individual_kpis',
    recordId: kpiId,
    oldData: kpi,
    description: `Penghapusan KPI '${kpi.kpiTitle}' (bobot ${kpi.kpiWeight}%)`,
  });

  return deleted;
}

/**
 * Tanam KPI pembuka (starter) untuk karyawan baru pada periode penilaian aktif.
 * Idempoten: tidak menambah KPI bila karyawan sudah punya KPI di periode tsb.
 *
 * Bila jabatan karyawan punya template (`position_kpi_templates`), template itu
 * dipakai; jika tidak → fallback 4 sasaran SMART generik.
 * Total bobot starter = 100% sehingga patuh aturan PRD §8 (bobot ≤ 100%).
 */
export async function seedStarterKpis(
  db: Db,
  employeeId: string,
  periodId: string
): Promise<{ seeded: boolean; kpis: any[]; source: 'template' | 'generic' | 'none' }> {
  const existing = await selectKpisByEmployee(db, employeeId, periodId);
  if (existing.length > 0) return { seeded: false, kpis: existing, source: 'none' };

  // Coba template KPI per jabatan lebih dulu.
  const tpl = (await db.execute(sql`
    SELECT t.kpi_title AS "kpiTitle", t.target_value::float8 AS "targetValue",
           t.unit_of_measure AS "unit", t.kpi_weight::float8 AS "kpiWeight",
           t.strategic_pillar_id AS "strategicPillarId"
      FROM position_kpi_templates t
      JOIN employees e ON e.position_id = t.position_id
     WHERE e.id = ${employeeId}::uuid AND t.is_active = TRUE
     ORDER BY t.display_order ASC
  `)) as unknown as { rows: Array<{ kpiTitle: string; targetValue: number; unit: string; kpiWeight: number; strategicPillarId: string | null }> };

  if (tpl.rows?.length) {
    const created: any[] = [];
    for (const t of tpl.rows) {
      const pillarId = t.strategicPillarId ?? (await defaultPillarId(db));
      if (!pillarId) continue;
      const row = await insertIndividualKpi(db, {
        periodId,
        employeeId,
        strategicPillarId: pillarId,
        kpiTitle: t.kpiTitle,
        targetValue: Number(t.targetValue),
        unitOfMeasure: t.unit,
        kpiWeight: Number(t.kpiWeight),
        status: 'SUBMITTED',
      });
      created.push(row);
    }
    if (created.length) return { seeded: true, kpis: created, source: 'template' };
  }

  const strategicPillarId = await defaultPillarId(db);
  if (!strategicPillarId) return { seeded: false, kpis: [], source: 'none' };

  // 4 sasaran SMART generik (Bobot 30/25/25/20 = 100%).
  const starters = [
    { title: 'Pencapaian Target Kerja Utama (Job Output)', target: 100, weight: 30 },
    { title: 'Kualitas & Ketepatan Waktu (SLA/Zero Defect)', target: 100, weight: 25 },
    { title: 'Kolaborasi Lintas Fungsi & Disiplin Proses', target: 100, weight: 25 },
    { title: 'Pengembangan Kompetensi & Knowledge Sharing', target: 100, weight: 20 },
  ];

  const created: any[] = [];
  for (const s of starters) {
    const row = await insertIndividualKpi(db, {
      periodId,
      employeeId,
      strategicPillarId,
      kpiTitle: s.title,
      targetValue: s.target,
      unitOfMeasure: '%',
      kpiWeight: s.weight,
      status: 'SUBMITTED',
    });
    created.push(row);
  }
  return { seeded: true, kpis: created, source: 'generic' };
}

/** Pilar strategis default (bobot tertinggi, aktif) untuk menautkan KPI. */
async function defaultPillarId(db: Db): Promise<string | null> {
  const pillar = (await db.execute(sql`
    SELECT id FROM strategic_pillars
     WHERE is_active = TRUE
     ORDER BY strategic_weight DESC, created_at ASC
     LIMIT 1
  `)) as unknown as { rows: Array<{ id: string }> };
  return pillar.rows[0]?.id ?? null;
}

// ---------------------------------------------------------------------------
// Pengaman tata kelola KPI
// ---------------------------------------------------------------------------

/** Batas jumlah indikator per KPI (pedoman praktik: 3–5 indikator). */
export const MIN_INDIKATOR = 3;
export const MAX_INDIKATOR = 5;
/** Nama fungsi daftar KPI per pegawai (dipakai UI & pengujian). */
export const listIndividualKpis = getEmployeeKpis;

export interface KelengkapanKpi {
  jumlahKpi: number;
  totalBobot: number;
  bobotPas: boolean;
  pesanBobot: string | null;
  jumlahIndikator: number;
  indikatorCukup: boolean;
  pesanIndikator: string | null;
  siapDisetujui: boolean;
}

/**
 * Periksa kelengkapan KPI seorang pegawai pada satu periode.
 *
 * Dua syarat agar KPI layak diajukan/disetujui:
 *   1. Total bobot seluruh KPI = 100% (bukan sekadar ≤ 100%). Bila kurang,
 *      skor akhir tidak sebanding dan penilaian menjadi tidak sah.
 *   2. Jumlah indikator dalam rentang 3–5. Terlalu sedikit membuat KPI kabur,
 *      terlalu banyak melemahkan fokus kerja.
 */
export async function periksaKelengkapanKpi(
  db: Db,
  employeeId: string,
  periodId: string,
): Promise<KelengkapanKpi> {
  const kpiRes = (await db.execute(sql`
    SELECT kpi_weight::float8 AS "bobot"
      FROM individual_kpis
     WHERE employee_id = ${employeeId}::uuid AND period_id = ${periodId}::uuid
  `)) as unknown as { rows: Array<{ bobot: number }> };
  const daftar = kpiRes.rows ?? [];
  const totalBobot = daftar.reduce((a, r) => a + Number(r.bobot ?? 0), 0);
  const bobotPas = Math.abs(totalBobot - 100) < 0.01;

  const indRes = (await db.execute(sql`
    SELECT count(*)::int AS n
      FROM kpi_indicators i
      JOIN individual_kpis k ON k.id = i.kpi_id
     WHERE k.employee_id = ${employeeId}::uuid
       AND k.period_id = ${periodId}::uuid
       AND i.is_active = TRUE
  `)) as unknown as { rows: Array<{ n: number }> };
  const jumlahIndikator = Number(indRes.rows?.[0]?.n ?? 0);
  const indikatorCukup = jumlahIndikator >= MIN_INDIKATOR && jumlahIndikator <= MAX_INDIKATOR;

  return {
    jumlahKpi: daftar.length,
    totalBobot,
    bobotPas,
    pesanBobot: bobotPas ? null : `Total bobot KPI harus tepat 100% (saat ini ${totalBobot}%).`,
    jumlahIndikator,
    indikatorCukup,
    pesanIndikator: indikatorCukup
      ? null
      : jumlahIndikator < MIN_INDIKATOR
      ? `Setiap KPI memerlukan minimal ${MIN_INDIKATOR} indikator (saat ini ${jumlahIndikator}).`
      : `Jumlah indikator maksimal ${MAX_INDIKATOR} (saat ini ${jumlahIndikator}).`,
    siapDisetujui: bobotPas && indikatorCukup && daftar.length > 0,
  };
}

/** Pastikan kelengkapan terpenuhi sebelum KPI disetujui. */
async function pastikanLayakDisetujui(
  db: Db,
  kpi: { id: string; employeeId: string; periodId: string; status: string },
): Promise<void> {
  if (kpi.status === 'APPROVED') {
    throw new BusinessRuleError('KPI ini sudah disetujui (APPROVED).');
  }
  const cek = await periksaKelengkapanKpi(db, kpi.employeeId, kpi.periodId);
  if (!cek.bobotPas) throw new BusinessRuleError(cek.pesanBobot!);
  if (!cek.indikatorCukup) throw new BusinessRuleError(cek.pesanIndikator!);
}

/**
 * Setujui KPI setelah memastikan syarat tata kelola terpenuhi.
 *
 * Berbeda dari `approveKpi` (yang hanya memeriksa wewenang), fungsi ini juga
 * menolak KPI yang bobotnya belum 100% atau indikatornya di luar 3–5.
 */
export async function approveIndividualKpi(
  db: Db,
  session: SessionPayload,
  kpiId: string,
) {
  assertCan(session, 'kpi:approve');
  const kpi = await selectKpiById(db, kpiId);
  if (!kpi) throw new NotFoundError(`KPI dengan ID '${kpiId}' tidak ditemukan.`);

  if (session.employeeId && session.employeeId === kpi.employeeId) {
    throw new ForbiddenError('Anda tidak dapat menyetujui KPI milik sendiri; persetujuan dilakukan atasan.');
  }
  const scope = await resolveVisibleEmployeeIds(db, session);
  assertEmployeeVisible(scope, kpi.employeeId);

  await pastikanLayakDisetujui(db, kpi as any);
  const approved = await updateKpiStatus(db, kpiId, 'APPROVED', session.userId);

  await logAction(db, {
    userId: session.userId,
    actionType: 'APPROVE',
    entityName: 'individual_kpis',
    recordId: kpiId,
    oldData: { status: kpi.status },
    newData: { status: 'APPROVED' },
    description: `Persetujuan KPI '${kpi.kpiTitle}' oleh ${session.email}`,
  });
  return approved;
}

/** Tolak KPI beserta alasannya. Alasan wajib agar pegawai tahu perbaikannya. */
export async function rejectIndividualKpi(
  db: Db,
  session: SessionPayload,
  kpiId: string,
  alasan: string,
) {
  assertCan(session, 'kpi:approve');
  if (!alasan || !alasan.trim()) {
    throw new BusinessRuleError('Penolakan KPI wajib menyertakan alasan.');
  }
  const kpi = await selectKpiById(db, kpiId);
  if (!kpi) throw new NotFoundError(`KPI dengan ID '${kpiId}' tidak ditemukan.`);
  if (session.employeeId && session.employeeId === kpi.employeeId) {
    throw new ForbiddenError('Anda tidak dapat menolak KPI milik sendiri.');
  }
  const scope = await resolveVisibleEmployeeIds(db, session);
  assertEmployeeVisible(scope, kpi.employeeId);

  const rejected = await updateKpiStatus(db, kpiId, 'REJECTED', session.userId);
  await logAction(db, {
    userId: session.userId,
    actionType: 'UPDATE',
    entityName: 'individual_kpis',
    recordId: kpiId,
    oldData: { status: kpi.status },
    newData: { status: 'REJECTED', alasan },
    description: `Penolakan KPI '${kpi.kpiTitle}' oleh ${session.email}: ${alasan}`,
  });
  return rejected;
}
