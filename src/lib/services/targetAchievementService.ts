import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';
import { assertCan } from '@/lib/auth/rbac';
import { resolveVisibleEmployeeIds, assertEmployeeVisible } from '@/lib/auth/scope';
import { resolvePeriodId, periodCodeOf } from './periodResolver';

export type AchievementStatus = 'EXCEEDED' | 'ON_TRACK' | 'AT_RISK' | 'CRITICAL';

export interface TargetAchievementResult {
  role: string;
  scopeLevel: 'INDIVIDUAL' | 'TEAM' | 'ORGANIZATION' | 'CORPORATE';
  periodId: string | null;
  periodCode: string | null;
  overallPercentage: number;
  status: AchievementStatus;
  statusLabel: string;
  statusColor: { text: string; bg: string; border: string; bar: string };
  targetCount: number;
  achievedCount: number;
  summary: {
    totalEntities: number;
    totalKpis: number;
    exceededCount: number;
    onTrackCount: number;
    atRiskCount: number;
    criticalCount: number;
  };
  employeeInfo?: {
    employeeId: string;
    fullName: string;
    employeeCode: string | null;
    position: string | null;
    department: string | null;
  };
  individualKpis?: Array<{
    id: string;
    title: string;
    targetValue: number;
    actualValue: number;
    unit: string;
    weight: number;
    achievementPercentage: number;
    status: AchievementStatus;
    pillarName?: string;
  }>;
  teamMembers?: Array<{
    employeeId: string;
    fullName: string;
    employeeCode: string | null;
    position: string | null;
    department: string | null;
    achievementPercentage: number;
    kpiCount: number;
    status: AchievementStatus;
  }>;
  departments?: Array<{
    departmentId: string;
    departmentName: string;
    averagePercentage: number;
    employeeCount: number;
    kpiCount: number;
    status: AchievementStatus;
  }>;
  perspectives?: Array<{
    perspective: string;
    perspectiveLabel: string;
    averagePercentage: number;
    kpiCount: number;
    status: AchievementStatus;
  }>;
  myOwn?: {
    overallPercentage: number;
    status: AchievementStatus;
    kpiCount: number;
  };
}

export function getAchievementStatus(percentage: number): AchievementStatus {
  if (percentage >= 100) return 'EXCEEDED';
  if (percentage >= 80) return 'ON_TRACK';
  if (percentage >= 60) return 'AT_RISK';
  return 'CRITICAL';
}

export function getStatusLabel(status: AchievementStatus): string {
  switch (status) {
    case 'EXCEEDED': return 'Melampaui Target';
    case 'ON_TRACK': return 'Sesuai Jalur';
    case 'AT_RISK': return 'Perlu Perhatian';
    case 'CRITICAL': return 'Di Bawah Target';
  }
}

export function getStatusColor(status: AchievementStatus): { text: string; bg: string; border: string; bar: string } {
  switch (status) {
    case 'EXCEEDED':
      return { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', bar: 'bg-emerald-500' };
    case 'ON_TRACK':
      return { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', bar: 'bg-blue-500' };
    case 'AT_RISK':
      return { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', bar: 'bg-amber-500' };
    case 'CRITICAL':
      return { text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', bar: 'bg-rose-500' };
  }
}

const PERSPECTIVE_LABELS: Record<string, string> = {
  FINANCIAL: 'Keuangan (Financial)',
  CUSTOMER: 'Pelanggan (Customer)',
  INTERNAL_PROCESS: 'Proses Bisnis Internal',
  LEARNING_GROWTH: 'Pembelajaran & Pertumbuhan',
};

export async function getTargetAchievement(
  db: Db,
  session: SessionPayload,
  options: { periodId?: string; departmentId?: string; employeeId?: string } = {}
): Promise<TargetAchievementResult> {
  assertCan(session, 'kpi:read');

  const resolvedPeriodId = options.periodId || (await resolvePeriodId(db));
  const periodCode = await periodCodeOf(db, resolvedPeriodId);
  const scope = await resolveVisibleEmployeeIds(db, session);

  // Jika diminta melihat spesifik karyawan (atau role EMPLOYEE)
  if (options.employeeId || session.role === 'EMPLOYEE') {
    const targetEmpId = options.employeeId || session.employeeId;
    if (!targetEmpId) {
      throw new Error('Tidak ada ID karyawan yang valid untuk sesi ini.');
    }
    assertEmployeeVisible(scope, targetEmpId);
    return getIndividualAchievement(db, session.role, targetEmpId, resolvedPeriodId, periodCode);
  }

  // Jika role PEOPLE_MANAGER tanpa employeeId spesifik -> Tampilkan capaian Tim
  if (session.role === 'PEOPLE_MANAGER') {
    return getTeamAchievement(db, session, resolvedPeriodId, periodCode, scope);
  }

  // Jika BOD -> Tampilkan capaian strategis korporasi (termasuk 4 perspektif BSC)
  if (session.role === 'BOD') {
    return getCorporateAchievement(db, session.role, resolvedPeriodId, periodCode, options.departmentId);
  }

  // Role organisasi: HR_MANAGER, BOD, SUPER_ADMIN
  return getOrganizationAchievement(db, session.role, resolvedPeriodId, periodCode, options.departmentId);
}

/** Hitung capaian target tingkat individu karyawan */
async function getIndividualAchievement(
  db: Db,
  role: string,
  employeeId: string,
  periodId: string | null,
  periodCode: string | null
): Promise<TargetAchievementResult> {
  const periodClause = periodId ? sql`AND ik.period_id = ${periodId}::uuid` : sql``;

  const [res, empRes] = await Promise.all([
    db.execute(sql`
      SELECT ik.id, ik.kpi_title AS "title",
             ik.target_value::float8 AS "targetValue",
             ik.actual_value::float8 AS "actualValue",
             ik.unit_of_measure AS "unit",
             ik.kpi_weight::float8 AS "weight",
             ik.achievement_percentage::float8 AS "achievementPercentage",
             sp.pillar_name AS "pillarName"
        FROM individual_kpis ik
        LEFT JOIN strategic_pillars sp ON sp.id = ik.strategic_pillar_id
       WHERE ik.employee_id = ${employeeId}::uuid
             ${periodClause}
       ORDER BY ik.kpi_weight DESC, ik.kpi_title ASC
    `) as unknown as Promise<{ rows: Array<Record<string, any>> }>,
    db.execute(sql`
      SELECT e.id AS "employeeId", e.full_name AS "fullName", e.employee_code AS "employeeCode",
             jp.position_title AS "position", d.department_name AS "department"
        FROM employees e
        LEFT JOIN departments d ON d.id = e.department_id
        LEFT JOIN job_positions jp ON jp.id = e.position_id
       WHERE e.id = ${employeeId}::uuid
       LIMIT 1
    `) as unknown as Promise<{ rows: Array<Record<string, any>> }>,
  ]);

  const empRow = empRes.rows[0];
  const employeeInfo = empRow
    ? {
        employeeId: String(empRow.employeeId),
        fullName: String(empRow.fullName),
        employeeCode: empRow.employeeCode ? String(empRow.employeeCode) : null,
        position: empRow.position ? String(empRow.position) : null,
        department: empRow.department ? String(empRow.department) : null,
      }
    : undefined;

  const items = res.rows.map((r) => {
    const ach = Number(r.achievementPercentage) || 0;
    return {
      id: String(r.id),
      title: String(r.title),
      targetValue: Number(r.targetValue),
      actualValue: Number(r.actualValue),
      unit: String(r.unit || '%'),
      weight: Number(r.weight),
      achievementPercentage: Math.round(ach * 10) / 10,
      status: getAchievementStatus(ach),
      pillarName: r.pillarName ? String(r.pillarName) : undefined,
    };
  });

  const totalWeight = items.reduce((s, k) => s + k.weight, 0);
  const weightedSum = items.reduce((s, k) => s + k.achievementPercentage * (k.weight / 100), 0);
  const overallPercentage =
    totalWeight > 0 ? Math.round((weightedSum / (totalWeight / 100)) * 10) / 10 : 0;

  const status = getAchievementStatus(overallPercentage);
  const achievedCount = items.filter((i) => i.achievementPercentage >= 100).length;

  let exceededCount = 0;
  let onTrackCount = 0;
  let atRiskCount = 0;
  let criticalCount = 0;

  items.forEach((i) => {
    if (i.status === 'EXCEEDED') exceededCount++;
    else if (i.status === 'ON_TRACK') onTrackCount++;
    else if (i.status === 'AT_RISK') atRiskCount++;
    else criticalCount++;
  });

  return {
    role,
    scopeLevel: 'INDIVIDUAL',
    periodId,
    periodCode,
    overallPercentage,
    status,
    statusLabel: `${getStatusLabel(status)} (${overallPercentage.toFixed(1)}%)`,
    statusColor: getStatusColor(status),
    targetCount: items.length,
    achievedCount,
    summary: {
      totalEntities: 1,
      totalKpis: items.length,
      exceededCount,
      onTrackCount,
      atRiskCount,
      criticalCount,
    },
    employeeInfo,
    individualKpis: items,
  };
}

/** Hitung capaian target tim bawahan untuk People Manager */
async function getTeamAchievement(
  db: Db,
  session: SessionPayload,
  periodId: string | null,
  periodCode: string | null,
  scope: string[] | 'ALL'
): Promise<TargetAchievementResult> {
  const allowedIds = scope === 'ALL' ? [] : scope;
  if (allowedIds.length === 0) {
    return createEmptyResult('PEOPLE_MANAGER', 'TEAM', periodId, periodCode);
  }

  const periodClause = periodId ? sql`AND ik.period_id = ${periodId}::uuid` : sql``;
  const idsSql = sql.raw(`ARRAY['${allowedIds.join("','")}']::uuid[]`);

  // Agregasi per karyawan dalam tim (termasuk manajer)
  const res = (await db.execute(sql`
    SELECT e.id AS "employeeId", e.full_name AS "fullName", e.employee_code AS "employeeCode",
           d.department_name AS "department", jp.position_title AS "position",
           COUNT(ik.id)::int AS "kpiCount",
           COALESCE(
             CASE WHEN SUM(ik.kpi_weight) > 0
                  THEN SUM(ik.achievement_percentage * (ik.kpi_weight / 100)) / (SUM(ik.kpi_weight) / 100)
                  ELSE 0
             END, 0
           )::float8 AS "achievementPercentage"
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN job_positions jp ON jp.id = e.position_id
      LEFT JOIN individual_kpis ik ON ik.employee_id = e.id ${periodClause}
     WHERE e.id = ANY(${idsSql})
     GROUP BY e.id, e.full_name, e.employee_code, d.department_name, jp.position_title
     ORDER BY "achievementPercentage" DESC, e.full_name ASC
  `)) as unknown as { rows: Array<Record<string, any>> };

  const members = res.rows.map((r) => {
    const ach = Math.round(Number(r.achievementPercentage || 0) * 10) / 10;
    return {
      employeeId: String(r.employeeId),
      fullName: String(r.fullName),
      employeeCode: r.employeeCode ? String(r.employeeCode) : null,
      position: r.position ? String(r.position) : null,
      department: r.department ? String(r.department) : null,
      achievementPercentage: ach,
      kpiCount: Number(r.kpiCount || 0),
      status: getAchievementStatus(ach),
    };
  });

  const totalMembers = members.length;
  const overallPercentage =
    totalMembers > 0
      ? Math.round((members.reduce((s, m) => s + m.achievementPercentage, 0) / totalMembers) * 10) / 10
      : 0;

  const status = getAchievementStatus(overallPercentage);
  const achievedCount = members.filter((m) => m.achievementPercentage >= 100).length;

  let exceededCount = 0;
  let onTrackCount = 0;
  let atRiskCount = 0;
  let criticalCount = 0;

  members.forEach((m) => {
    if (m.status === 'EXCEEDED') exceededCount++;
    else if (m.status === 'ON_TRACK') onTrackCount++;
    else if (m.status === 'AT_RISK') atRiskCount++;
    else criticalCount++;
  });

  // Cari capaian diri sendiri milik manajer
  const myMember = members.find((m) => m.employeeId === session.employeeId);
  const myOwn = myMember
    ? {
        overallPercentage: myMember.achievementPercentage,
        status: myMember.status,
        kpiCount: myMember.kpiCount,
      }
    : undefined;

  return {
    role: session.role,
    scopeLevel: 'TEAM',
    periodId,
    periodCode,
    overallPercentage,
    status,
    statusLabel: `${getStatusLabel(status)} (${overallPercentage.toFixed(1)}%)`,
    statusColor: getStatusColor(status),
    targetCount: members.reduce((s, m) => s + m.kpiCount, 0),
    achievedCount,
    summary: {
      totalEntities: totalMembers,
      totalKpis: members.reduce((s, m) => s + m.kpiCount, 0),
      exceededCount,
      onTrackCount,
      atRiskCount,
      criticalCount,
    },
    teamMembers: members,
    myOwn,
  };
}

/** Hitung capaian organisasi lintas departemen (HR, BOD, Super Admin) */
async function getOrganizationAchievement(
  db: Db,
  role: string,
  periodId: string | null,
  periodCode: string | null,
  departmentId?: string
): Promise<TargetAchievementResult> {
  const periodClause = periodId ? sql`AND ik.period_id = ${periodId}::uuid` : sql``;
  const deptFilterClause = departmentId ? sql`WHERE d.id = ${departmentId}::uuid` : sql``;

  // 1. Agregasi per Departemen
  const deptRes = (await db.execute(sql`
    SELECT d.id AS "departmentId", d.department_name AS "departmentName",
           COUNT(DISTINCT e.id)::int AS "employeeCount",
           COUNT(ik.id)::int AS "kpiCount",
           COALESCE(
             CASE WHEN SUM(ik.kpi_weight) > 0
                  THEN SUM(ik.achievement_percentage * (ik.kpi_weight / 100)) / (SUM(ik.kpi_weight) / 100)
                  ELSE 0
             END, 0
           )::float8 AS "averagePercentage"
      FROM departments d
      LEFT JOIN employees e ON e.department_id = d.id AND e.status IN ('PROBATION', 'PERMANENT', 'CONTRACT')
      LEFT JOIN individual_kpis ik ON ik.employee_id = e.id ${periodClause}
     ${deptFilterClause}
     GROUP BY d.id, d.department_name
     ORDER BY "averagePercentage" DESC, d.department_name ASC
  `)) as unknown as { rows: Array<Record<string, any>> };

  const departments = deptRes.rows.map((r) => {
    const ach = Math.round(Number(r.averagePercentage || 0) * 10) / 10;
    return {
      departmentId: String(r.departmentId),
      departmentName: String(r.departmentName),
      averagePercentage: ach,
      employeeCount: Number(r.employeeCount || 0),
      kpiCount: Number(r.kpiCount || 0),
      status: getAchievementStatus(ach),
    };
  });

  const totalDepts = departments.length;
  const overallPercentage =
    totalDepts > 0
      ? Math.round(
          (departments.reduce((s, d) => s + d.averagePercentage, 0) / totalDepts) * 10
        ) / 10
      : 0;

  const status = getAchievementStatus(overallPercentage);

  let exceededCount = 0;
  let onTrackCount = 0;
  let atRiskCount = 0;
  let criticalCount = 0;

  departments.forEach((d) => {
    if (d.status === 'EXCEEDED') exceededCount++;
    else if (d.status === 'ON_TRACK') onTrackCount++;
    else if (d.status === 'AT_RISK') atRiskCount++;
    else criticalCount++;
  });

  // Jika departmentId disediakan, ambil juga daftar karyawan di departemen tersebut
  let teamMembers: TargetAchievementResult['teamMembers'];
  if (departmentId) {
    const empRes = (await db.execute(sql`
      SELECT e.id AS "employeeId", e.full_name AS "fullName", e.employee_code AS "employeeCode",
             jp.position_title AS "position", d.department_name AS "department",
             COUNT(ik.id)::int AS "kpiCount",
             COALESCE(
               CASE WHEN SUM(ik.kpi_weight) > 0
                    THEN SUM(ik.achievement_percentage * (ik.kpi_weight / 100)) / (SUM(ik.kpi_weight) / 100)
                    ELSE 0
               END, 0
             )::float8 AS "achievementPercentage"
        FROM employees e
        JOIN departments d ON d.id = e.department_id
        LEFT JOIN job_positions jp ON jp.id = e.position_id
        LEFT JOIN individual_kpis ik ON ik.employee_id = e.id ${periodClause}
       WHERE d.id = ${departmentId}::uuid
         AND e.status IN ('PROBATION', 'PERMANENT', 'CONTRACT')
       GROUP BY e.id, e.full_name, e.employee_code, jp.position_title, d.department_name
       ORDER BY "achievementPercentage" DESC, e.full_name ASC
    `)) as unknown as { rows: Array<Record<string, any>> };

    teamMembers = empRes.rows.map((r) => {
      const ach = Math.round(Number(r.achievementPercentage || 0) * 10) / 10;
      return {
        employeeId: String(r.employeeId),
        fullName: String(r.fullName),
        employeeCode: r.employeeCode ? String(r.employeeCode) : null,
        position: r.position ? String(r.position) : null,
        department: r.department ? String(r.department) : null,
        achievementPercentage: ach,
        kpiCount: Number(r.kpiCount || 0),
        status: getAchievementStatus(ach),
      };
    });
  }

  return {
    role,
    scopeLevel: 'ORGANIZATION',
    periodId,
    periodCode,
    overallPercentage,
    status,
    statusLabel: `${getStatusLabel(status)} (${overallPercentage.toFixed(1)}%)`,
    statusColor: getStatusColor(status),
    targetCount: departments.reduce((s, d) => s + d.kpiCount, 0),
    achievedCount: departments.filter((d) => d.averagePercentage >= 100).length,
    summary: {
      totalEntities: departments.reduce((s, d) => s + d.employeeCount, 0),
      totalKpis: departments.reduce((s, d) => s + d.kpiCount, 0),
      exceededCount,
      onTrackCount,
      atRiskCount,
      criticalCount,
    },
    departments,
    teamMembers,
  };
}

/** Hitung capaian target korporasi & perspektif Balanced Scorecard untuk BOD */
async function getCorporateAchievement(
  db: Db,
  role: string,
  periodId: string | null,
  periodCode: string | null,
  departmentId?: string
): Promise<TargetAchievementResult> {
  // Ambil data dasar departemen terlebih dahulu
  const orgResult = await getOrganizationAchievement(db, role, periodId, periodCode, departmentId);

  // Ambil agregasi per Perspektif BSC (Financial, Customer, Internal Process, Learning & Growth)
  const periodClause = periodId ? sql`AND ik.period_id = ${periodId}::uuid` : sql``;
  const persRes = (await db.execute(sql`
    SELECT sp.perspective,
           COUNT(ik.id)::int AS "kpiCount",
           COALESCE(
             CASE WHEN SUM(ik.kpi_weight) > 0
                  THEN SUM(ik.achievement_percentage * (ik.kpi_weight / 100)) / (SUM(ik.kpi_weight) / 100)
                  ELSE 0
             END, 0
           )::float8 AS "averagePercentage"
      FROM strategic_pillars sp
      LEFT JOIN individual_kpis ik ON ik.strategic_pillar_id = sp.id ${periodClause}
     GROUP BY sp.perspective
     ORDER BY sp.perspective ASC
  `)) as unknown as { rows: Array<Record<string, any>> };

  const perspectives = persRes.rows.map((r) => {
    const ach = Math.round(Number(r.averagePercentage || 0) * 10) / 10;
    const pKey = String(r.perspective);
    return {
      perspective: pKey,
      perspectiveLabel: PERSPECTIVE_LABELS[pKey] || pKey,
      averagePercentage: ach,
      kpiCount: Number(r.kpiCount || 0),
      status: getAchievementStatus(ach),
    };
  });

  return {
    ...orgResult,
    scopeLevel: 'CORPORATE',
    perspectives,
  };
}

function createEmptyResult(
  role: string,
  scopeLevel: TargetAchievementResult['scopeLevel'],
  periodId: string | null,
  periodCode: string | null
): TargetAchievementResult {
  return {
    role,
    scopeLevel,
    periodId,
    periodCode,
    overallPercentage: 0,
    status: 'CRITICAL',
    statusLabel: 'Belum Ada Data (0.0%)',
    statusColor: getStatusColor('CRITICAL'),
    targetCount: 0,
    achievedCount: 0,
    summary: {
      totalEntities: 0,
      totalKpis: 0,
      exceededCount: 0,
      onTrackCount: 0,
      atRiskCount: 0,
      criticalCount: 0,
    },
  };
}
