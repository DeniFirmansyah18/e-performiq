/**
 * Layanan KPI berjenjang: operasi basis data untuk menyusun, menurunkan, dan
 * menelaah rantai KPI BOD → HR → People Manager → Posisi → Pegawai.
 *
 * Aturan otorisasi tiap tingkat dan penurunan satu-tingkat-ke-bawah memakai
 * `PENETAP_TINGKAT` / `bolehTurunkan` dari `kpiCascade.ts`; telaah integritas
 * memakai `telaahRantai`. Setiap penetapan KPI dicatat pada `kpi_cascade_log`
 * sehingga alur dapat diaudit end-to-end.
 */

import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError, ForbiddenError, NotFoundError } from '@/lib/auth/errors';
import { telaahRantai, type TingkatKpi } from '@/lib/services/kpiCascade';

/** Aktor yang melakukan tindakan (dari sesi login). */
export interface CascadeActor {
  userId: string;
  employeeId: string | null;
  role: string;
}

/** Cek bobot KPI: wajib angka berhingga > 0 dan <= 100. */
export function validasiBobotKpi(n: number): boolean {
  return Number.isFinite(n) && n > 0 && n <= 100;
}

/** Peran diizinkan menetapkan KPI pada tingkat tertentu, else Forbidden. */
function pastikanBolehSetTingkat(peran: string, tingkat: TingkatKpi): void {
  const diizinkan = (
    {
      PERUSAHAAN: ['BOD', 'SUPER_ADMIN'],
      DEPARTEMEN: ['HR_MANAGER', 'SUPER_ADMIN'],
      MANAJER: ['HR_MANAGER', 'PEOPLE_MANAGER', 'SUPER_ADMIN'],
      POSISI: ['HR_MANAGER', 'PEOPLE_MANAGER', 'SUPER_ADMIN'],
      INDIVIDU: ['EMPLOYEE', 'PEOPLE_MANAGER', 'HR_MANAGER', 'SUPER_ADMIN'],
    } as Record<TingkatKpi, string[]>
  )[tingkat];
  if (!diizinkan.includes(peran)) {
    throw new ForbiddenError(
      `Peran ${peran} tidak berwenang menetapkan KPI pada tingkat ${tingkat}.`
    );
  }
}

/* ------------------------------------------------------------------ */
/* KPI KORPORAT (tingkat PERUSAHAAN — BOD)                            */
/* ------------------------------------------------------------------ */

export async function listCorporateKpis(
  db: Db,
  periodYear?: number
): Promise<Array<{
  id: string;
  kpiCode: string;
  kpiName: string;
  pillarName: string;
  perspective: string;
  targetValue: number;
  unitOfMeasure: string;
  divisionKpiCount: number;
}>> {
  const res = (await db.execute(sql`
    SELECT ck.id::text AS id,
           ck.kpi_code AS "kpiCode",
           ck.kpi_name AS "kpiName",
           sp.pillar_name AS "pillarName",
           sp.perspective::text AS perspective,
           ck.target_value::float8 AS "targetValue",
           ck.unit_of_measure AS "unitOfMeasure",
           (SELECT COUNT(*)::int FROM division_kpis dk WHERE dk.corporate_kpi_id = ck.id)
             AS "divisionKpiCount"
      FROM corporate_kpis ck
      JOIN strategic_pillars sp ON sp.id = ck.strategic_pillar_id
     WHERE (${periodYear ?? null}::int IS NULL OR ck.period_year = ${periodYear ?? null}::int)
     ORDER BY ck.period_year DESC, ck.kpi_code ASC
  `)) as unknown as { rows: Array<{
    id: string; kpiCode: string; kpiName: string; pillarName: string; perspective: string;
    targetValue: number; unitOfMeasure: string; divisionKpiCount: number;
  }> };
  return res.rows ?? [];
}

export async function createCorporateKpi(
  db: Db,
  actor: CascadeActor,
  data: {
    pillarId: string;
    periodYear: number;
    kpiName: string;
    targetValue: number;
    unitOfMeasure: string;
    kpiCode: string;
  }
): Promise<{ id: string; kpiCode: string }> {
  pastikanBolehSetTingkat(actor.role, 'PERUSAHAAN');

  const pilar = (await db.execute(sql`
    SELECT id FROM strategic_pillars WHERE id = ${data.pillarId}::uuid AND is_active = TRUE
  `)) as unknown as { rows: Array<{ id: string }> };
  if (!pilar.rows?.length) {
    throw new NotFoundError(`Pilar strategis tidak ditemukan atau tidak aktif.`);
  }
  if (!data.kpiName?.trim()) {
    throw new BusinessRuleError('Nama KPI korporat wajib diisi.');
  }
  if (data.targetValue <= 0) {
    throw new BusinessRuleError('Target KPI korporat wajib lebih besar dari 0.');
  }

  const ins = (await db.execute(sql`
    INSERT INTO corporate_kpis
      (strategic_pillar_id, period_year, kpi_code, kpi_name, target_value, unit_of_measure)
    VALUES (${data.pillarId}::uuid, ${data.periodYear}, ${data.kpiCode},
            ${data.kpiName}, ${data.targetValue}::float8, ${data.unitOfMeasure})
    RETURNING id::text AS id, kpi_code AS "kpiCode"
  `)) as unknown as { rows: Array<{ id: string; kpiCode: string }> };
  const row = ins.rows[0];

  await catatCascade(db, actor, {
    dari: 'PERUSAHAAN', ke: 'PERUSAHAAN',
    kodeSumber: 'VISI_MISI', kodeHasil: row.id,
    sumberAi: false, catatan: `KPI korporat ${row.kpiCode} ditetapkan oleh BOD.`,
  });
  return row;
}

/* ------------------------------------------------------------------ */
/* KPI DIVISI (tingkat DEPARTEMEN — HR)                               */
/* ------------------------------------------------------------------ */

export async function listDivisionKpis(
  db: Db,
  corporateKpiId?: string
): Promise<Array<{
  id: string; corporateKpiId: string; kpiTitle: string; targetValue: number;
  weightPct: number; departmentName: string; managerKpiCount: number;
}>> {
  const res = (await db.execute(sql`
    SELECT dk.id::text AS id,
           dk.corporate_kpi_id::text AS "corporateKpiId",
           dk.kpi_title AS "kpiTitle",
           dk.target_value::float8 AS "targetValue",
           dk.weight_pct::float8 AS "weightPct",
           d.department_name AS "departmentName",
           (SELECT COUNT(*)::int FROM manager_kpis mk WHERE mk.division_kpi_id = dk.id)
             AS "managerKpiCount"
      FROM division_kpis dk
      JOIN departments d ON d.id = dk.department_id
     WHERE (${corporateKpiId ?? null}::uuid IS NULL
            OR dk.corporate_kpi_id = ${corporateKpiId ?? null}::uuid)
     ORDER BY d.department_name ASC, dk.kpi_title ASC
  `)) as unknown as { rows: Array<{
    id: string; corporateKpiId: string; kpiTitle: string; targetValue: number;
    weightPct: number; departmentName: string; managerKpiCount: number;
  }> };
  return res.rows ?? [];
}

export async function createDivisionKpi(
  db: Db,
  actor: CascadeActor,
  data: {
    corporateKpiId: string; departmentId: string; kpiTitle: string;
    targetValue: number; weightPct: number;
  }
): Promise<{ id: string }> {
  pastikanBolehSetTingkat(actor.role, 'DEPARTEMEN');

  if (!validasiBobotKpi(data.weightPct)) {
    throw new BusinessRuleError(
      `Bobot KPI divisi wajib antara 1% sampai 100% (diterima: ${data.weightPct}).`
    );
  }
  if (data.targetValue <= 0) {
    throw new BusinessRuleError('Target KPI divisi wajib lebih besar dari 0.');
  }

  const induk = (await db.execute(sql`
    SELECT id::text AS id, kpi_code AS kode FROM corporate_kpis WHERE id = ${data.corporateKpiId}::uuid
  `)) as unknown as { rows: Array<{ id: string; kode: string }> };
  if (!induk.rows?.length) throw new NotFoundError('KPI korporat induk tidak ditemukan.');

  const ins = (await db.execute(sql`
    INSERT INTO division_kpis
      (corporate_kpi_id, department_id, kpi_title, weight_pct, target_value)
    VALUES (${data.corporateKpiId}::uuid, ${data.departmentId}::uuid,
            ${data.kpiTitle}, ${data.weightPct}::float8, ${data.targetValue}::float8)
    RETURNING id::text AS id
  `)) as unknown as { rows: Array<{ id: string }> };

  await catatCascade(db, actor, {
    dari: 'PERUSAHAAN', ke: 'DEPARTEMEN',
    kodeSumber: induk.rows[0].id, kodeHasil: ins.rows[0].id,
    sumberAi: false, catatan: `KPI divisi "${data.kpiTitle}" diturunkan oleh HR.`,
  });
  return ins.rows[0];
}

/* ------------------------------------------------------------------ */
/* KPI MANAJER (tingkat MANAJER — People Manager)                     */
/* ------------------------------------------------------------------ */

export async function listManagerKpis(
  db: Db,
  divisionKpiId?: string
): Promise<Array<{
  id: string; divisionKpiId: string; employeeId: string; employeeName: string;
  kpiTitle: string; targetValue: number; unitOfMeasure: string; weightPct: number;
  positionKpiCount: number;
}>> {
  const res = (await db.execute(sql`
    SELECT mk.id::text AS id,
           mk.division_kpi_id::text AS "divisionKpiId",
           mk.employee_id::text AS "employeeId",
           e.full_name AS "employeeName",
           mk.kpi_title AS "kpiTitle",
           mk.target_value::float8 AS "targetValue",
           mk.unit_of_measure AS "unitOfMeasure",
           mk.weight_pct::float8 AS "weightPct",
           (SELECT COUNT(*)::int FROM position_kpis pk WHERE pk.manager_kpi_id = mk.id)
             AS "positionKpiCount"
      FROM manager_kpis mk
      JOIN employees e ON e.id = mk.employee_id
     WHERE (${divisionKpiId ?? null}::uuid IS NULL
            OR mk.division_kpi_id = ${divisionKpiId ?? null}::uuid)
     ORDER BY e.full_name ASC, mk.kpi_title ASC
  `)) as unknown as { rows: Array<{
    id: string; divisionKpiId: string; employeeId: string; employeeName: string;
    kpiTitle: string; targetValue: number; unitOfMeasure: string; weightPct: number;
    positionKpiCount: number;
  }> };
  return res.rows ?? [];
}

export async function createManagerKpi(
  db: Db,
  actor: CascadeActor,
  data: {
    divisionKpiId: string; employeeId: string; kpiTitle: string;
    targetValue: number; unitOfMeasure: string; weightPct: number;
  }
): Promise<{ id: string }> {
  pastikanBolehSetTingkat(actor.role, 'MANAJER');

  if (!validasiBobotKpi(data.weightPct)) {
    throw new BusinessRuleError(
      `Bobot KPI manajer wajib antara 1% sampai 100% (diterima: ${data.weightPct}).`
    );
  }
  if (data.targetValue <= 0) {
    throw new BusinessRuleError('Target KPI manajer wajib lebih besar dari 0.');
  }

  const induk = (await db.execute(sql`
    SELECT id::text AS id FROM division_kpis WHERE id = ${data.divisionKpiId}::uuid
  `)) as unknown as { rows: Array<{ id: string }> };
  if (!induk.rows?.length) throw new NotFoundError('KPI divisi induk tidak ditemukan.');

  const ins = (await db.execute(sql`
    INSERT INTO manager_kpis
      (division_kpi_id, employee_id, kpi_title, target_value, unit_of_measure, weight_pct)
    VALUES (${data.divisionKpiId}::uuid, ${data.employeeId}::uuid,
            ${data.kpiTitle}, ${data.targetValue}::float8,
            ${data.unitOfMeasure}, ${data.weightPct}::float8)
    RETURNING id::text AS id
  `)) as unknown as { rows: Array<{ id: string }> };

  await catatCascade(db, actor, {
    dari: 'DEPARTEMEN', ke: 'MANAJER',
    kodeSumber: data.divisionKpiId, kodeHasil: ins.rows[0].id,
    sumberAi: false, catatan: `KPI manajer "${data.kpiTitle}" diturunkan.`,
  });
  return ins.rows[0];
}

/* ------------------------------------------------------------------ */
/* KPI POSISI (tingkat POSISI — People Manager)                       */
/* ------------------------------------------------------------------ */

export async function listPositionKpis(
  db: Db,
  managerKpiId?: string
): Promise<Array<{
  id: string; managerKpiId: string | null; positionId: string; positionTitle: string;
  kpiTitle: string; targetValue: number; unitOfMeasure: string; weightPct: number;
  individualKpiCount: number;
}>> {
  const res = (await db.execute(sql`
    SELECT pk.id::text AS id,
           pk.manager_kpi_id::text AS "managerKpiId",
           pk.position_id::text AS "positionId",
           jp.position_title AS "positionTitle",
           pk.kpi_title AS "kpiTitle",
           pk.target_value::float8 AS "targetValue",
           pk.unit_of_measure AS "unitOfMeasure",
           pk.weight_pct::float8 AS "weightPct",
           (SELECT COUNT(*)::int FROM individual_kpis ik WHERE ik.position_kpi_id = pk.id)
             AS "individualKpiCount"
      FROM position_kpis pk
      JOIN job_positions jp ON jp.id = pk.position_id
     WHERE (${managerKpiId ?? null}::uuid IS NULL
            OR pk.manager_kpi_id = ${managerKpiId ?? null}::uuid)
     ORDER BY jp.position_title ASC, pk.kpi_title ASC
  `)) as unknown as { rows: Array<{
    id: string; managerKpiId: string | null; positionId: string; positionTitle: string;
    kpiTitle: string; targetValue: number; unitOfMeasure: string; weightPct: number;
    individualKpiCount: number;
  }> };
  return res.rows ?? [];
}

export async function createPositionKpi(
  db: Db,
  actor: CascadeActor,
  data: {
    managerKpiId?: string | null; positionId: string; kpiTitle: string;
    targetValue: number; unitOfMeasure: string; weightPct: number;
  }
): Promise<{ id: string }> {
  pastikanBolehSetTingkat(actor.role, 'POSISI');

  if (!validasiBobotKpi(data.weightPct)) {
    throw new BusinessRuleError(
      `Bobot KPI posisi wajib antara 1% sampai 100% (diterima: ${data.weightPct}).`
    );
  }
  if (data.targetValue <= 0) {
    throw new BusinessRuleError('Target KPI posisi wajib lebih besar dari 0.');
  }

  const induk = (await db.execute(sql`
    SELECT id::text AS id FROM manager_kpis WHERE id = ${data.managerKpiId ?? null}::uuid
  `)) as unknown as { rows: Array<{ id: string }> };
  const indukId = induk.rows?.[0]?.id ?? null;

  const ins = (await db.execute(sql`
    INSERT INTO position_kpis
      (manager_kpi_id, position_id, kpi_title, target_value, unit_of_measure, weight_pct)
    VALUES (${indukId}::uuid, ${data.positionId}::uuid,
            ${data.kpiTitle}, ${data.targetValue}::float8,
            ${data.unitOfMeasure}, ${data.weightPct}::float8)
    RETURNING id::text AS id
  `)) as unknown as { rows: Array<{ id: string }> };

  await catatCascade(db, actor, {
    dari: 'MANAJER', ke: 'POSISI',
    kodeSumber: indukId ?? 'MANUAL', kodeHasil: ins.rows[0].id,
    sumberAi: false, catatan: `KPI posisi "${data.kpiTitle}" diturunkan.`,
  });
  return ins.rows[0];
}

/* ------------------------------------------------------------------ */
/* POHON & INTEGRITAS                                                  */
/* ------------------------------------------------------------------ */

export interface KpiCascadeNode {
  id: string;
  title: string;
  level: 'CORPORATE' | 'DIVISION' | 'MANAGER' | 'POSITION';
  code: string;
  targetValue: number;
  weightPct?: number;
  owner: string | null;
  children: KpiCascadeNode[];
}

/** Bangun pohon KPI berjenjang lengkap (korporat → divisi → manajer → posisi). */
export async function getCascadeTree(db: Db): Promise<KpiCascadeNode[]> {
  const korporat = await db.execute(sql`
    SELECT ck.id::text AS id, ck.kpi_code AS kode, ck.kpi_name AS judul,
           ck.target_value::float8 AS target, ck.kpi_code AS kode2
      FROM corporate_kpis ck ORDER BY ck.kpi_code ASC
  `);
  const divisi = await db.execute(sql`
    SELECT dk.id::text AS id, dk.corporate_kpi_id::text AS induk,
           dk.kpi_title AS judul, dk.target_value::float8 AS target,
           dk.weight_pct::float8 AS bobot, d.department_name AS pemilik
      FROM division_kpis dk JOIN departments d ON d.id = dk.department_id
     ORDER BY d.department_name ASC
  `);
  const manajer = await db.execute(sql`
    SELECT mk.id::text AS id, mk.division_kpi_id::text AS induk,
           mk.kpi_title AS judul, mk.target_value::float8 AS target,
           mk.unit_of_measure AS satuan, mk.weight_pct::float8 AS bobot,
           e.full_name AS pemilik
      FROM manager_kpis mk JOIN employees e ON e.id = mk.employee_id
     ORDER BY e.full_name ASC
  `);
  const posisi = await db.execute(sql`
    SELECT pk.id::text AS id, pk.manager_kpi_id::text AS induk,
           pk.kpi_title AS judul, pk.target_value::float8 AS target,
           pk.unit_of_measure AS satuan, pk.weight_pct::float8 AS bobot,
           jp.position_title AS pemilik
      FROM position_kpis pk JOIN job_positions jp ON jp.id = pk.position_id
     ORDER BY jp.position_title ASC
  `);

  type Row = { id: string; induk: string | null; judul: string; target: number;
               bobot?: number; satuan?: string; pemilik: string; kode?: string };

  const mkNode = (r: Row): KpiCascadeNode => ({
    id: r.id,
    title: r.judul,
    level: 'POSITION',
    code: r.kode ?? r.induk ?? '',
    targetValue: Number(r.target),
    owner: r.pemilik ?? null,
    children: [],
  });

  // Bangun peta per tingkat.
  const divisiRows = (divisi as unknown as { rows: Row[] }).rows ?? [];
  const manajerRows = (manajer as unknown as { rows: Row[] }).rows ?? [];
  const posisiRows = (posisi as unknown as { rows: Row[] }).rows ?? [];

  const posisiNodes = new Map<string, KpiCascadeNode>();
  for (const r of posisiRows) {
    const n = mkNode(r);
    n.level = 'POSITION';
    n.weightPct = Number(r.bobot);
    posisiNodes.set(r.id, n);
  }
  const manajerNodes = new Map<string, KpiCascadeNode>();
  for (const r of manajerRows) {
    const n: KpiCascadeNode = {
      id: r.id, title: r.judul, level: 'MANAGER', code: r.id,
      targetValue: Number(r.target), weightPct: Number(r.bobot),
      owner: r.pemilik, children: [],
    };
    manajerNodes.set(r.id, n);
  }
  // Lampirkan posisi ke manajer.
  for (const r of posisiRows) {
    const induk = manajerNodes.get(r.induk ?? '');
    if (induk && r.induk) induk.children.push(posisiNodes.get(r.id)!);
  }
  const divisiNodes = new Map<string, KpiCascadeNode>();
  for (const r of divisiRows) {
    const n: KpiCascadeNode = {
      id: r.id, title: r.judul, level: 'DIVISION', code: r.id,
      targetValue: Number(r.target), weightPct: Number(r.bobot),
      owner: r.pemilik, children: [],
    };
    divisiNodes.set(r.id, n);
  }
  // Lampirkan manajer ke divisi.
  for (const r of manajerRows) {
    const induk = divisiNodes.get(r.induk ?? '');
    if (induk && r.induk) induk.children.push(manajerNodes.get(r.id)!);
  }
  // Susun pohon dari korporat.
  const korporatRows = (korporat as unknown as { rows: Array<{ id: string; kode: string; judul: string; target: number }> }).rows ?? [];
  const pohon: KpiCascadeNode[] = [];
  for (const r of korporatRows) {
    const node: KpiCascadeNode = {
      id: r.id, title: r.judul, level: 'CORPORATE', code: r.kode,
      targetValue: Number(r.target), owner: null, children: [],
    };
    for (const d of divisiRows) {
      if (d.induk === r.id) node.children.push(divisiNodes.get(d.id)!);
    }
    pohon.push(node);
  }
  return pohon;
}

/** Telaah integritas rantai: apakah semua KPI tersambung ke pilar strategis. */
export async function getCascadeIntegrity(db: Db) {
  const rows = await db.execute(sql`
    SELECT id::text AS kode, kpi_name AS judul, 'PERUSAHAAN' AS tingkat,
           NULL::text AS induk
      FROM corporate_kpis
    UNION ALL
    SELECT dk.id::text, dk.kpi_title, 'DEPARTEMEN', dk.corporate_kpi_id::text
      FROM division_kpis dk
    UNION ALL
    SELECT mk.id::text, mk.kpi_title, 'MANAJER', mk.division_kpi_id::text
      FROM manager_kpis mk
    UNION ALL
    SELECT pk.id::text, pk.kpi_title, 'POSISI', pk.manager_kpi_id::text
      FROM position_kpis pk
  `);
  const mata = ((rows as unknown as { rows: Array<{ kode: string; judul: string; tingkat: TingkatKpi; induk: string | null }> }).rows ?? [])
    .map((r) => ({
      kode: r.kode, judul: r.judul, tingkat: r.tingkat, induk: r.induk,
    }));
  return telaahRantai(mata);
}

/* ------------------------------------------------------------------ */
/* CATATAN CASCADE LOG                                                 */
/* ------------------------------------------------------------------ */

async function catatCascade(
  db: Db,
  actor: CascadeActor,
  data: {
    dari: TingkatKpi; ke: TingkatKpi; kodeSumber: string; kodeHasil: string;
    sumberAi: boolean; catatan: string;
  }
): Promise<void> {
  await db.execute(sql`
    INSERT INTO kpi_cascade_log
      (tingkat_dari, tingkat_ke, kode_sumber, kode_hasil, dilakukan_oleh, sumber_ai, catatan)
    VALUES (${data.dari}, ${data.ke}, ${data.kodeSumber}, ${data.kodeHasil},
            ${actor.userId}::uuid, ${data.sumberAi}, ${data.catatan})
  `);
}
