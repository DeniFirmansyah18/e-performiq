/**
 * Dashboard Aggregation Service (WS-11) — agregasi lintas-modul untuk HR/Manager,
 * termasuk modul baru (rekrutmen, LMS onboarding, absensi, payroll) + pasca-kerja.
 *
 * Read-only, driver-agnostic, best-effort (tiap query dibungkus agar satu kegagalan
 * tidak merusak seluruh ringkasan).
 */
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

/** Jalankan query dan kembalikan baris pertama; aman bila gagal. */
async function safeRow<T = any>(db: Db, query: ReturnType<typeof sql>): Promise<T | null> {
  try {
    const res = (await db.execute(query)) as unknown as { rows: T[] };
    return res.rows?.[0] ?? null;
  } catch {
    return null;
  }
}

export interface HrDashboard {
  generatedAt: string;
  workforce: {
    total: number;
    permanent: number;
    probation: number;
    contract: number;
    resigned: number;
  };
  recruitment: {
    openPostings: number;
    totalApplications: number;
    inReview: number;
    accepted: number;
    rejected: number;
    talentPool: number;
    avgAtsScore: number | null;
  };
  onboarding: {
    activePrograms: number;
    completedPrograms: number;
    certificatesIssued: number;
  };
  attendance: {
    openLogsToday: number;
    closedLogsToday: number;
    pendingTimesheets: number;
    overtimeHoursThisMonth: number;
  };
  payroll: {
    latestPeriod: string | null;
    latestStatus: string | null;
    latestTotalNet: number | null;
    totalRuns: number;
  };
  learning: {
    totalCourses: number;
    enrollments: number;
    completions: number;
    completionRate: number;
  };
  postEmployment: {
    activeOffboardings: number;
    knowledgeHandoversPending: number;
    severancesPending: number;
    totalLifetimeContributions: number;
  };
}

/** Ringkasan lengkap dashboard HR/Manager. */
export async function getHrDashboard(db: Db): Promise<HrDashboard> {
  const wf = await safeRow<{ total: number; permanent: number; probation: number; contract: number; resigned: number }>(db, sql`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'PERMANENT')::int AS permanent,
           COUNT(*) FILTER (WHERE status = 'PROBATION')::int AS probation,
           COUNT(*) FILTER (WHERE status = 'CONTRACT')::int AS contract,
           COUNT(*) FILTER (WHERE status IN ('RESIGNED','RETIRED'))::int AS resigned
      FROM employees
  `);

  const rec = await safeRow<any>(db, sql`
    SELECT
      (SELECT COUNT(*)::int FROM job_postings WHERE status = 'OPEN') AS "openPostings",
      (SELECT COUNT(*)::int FROM job_applications) AS "totalApplications",
      (SELECT COUNT(*)::int FROM job_applications WHERE status IN ('SUBMITTED','SCREENING','INTERVIEW')) AS "inReview",
      (SELECT COUNT(*)::int FROM candidate_decisions WHERE decision = 'ACCEPTED') AS "accepted",
      (SELECT COUNT(*)::int FROM candidate_decisions WHERE decision = 'REJECTED') AS "rejected",
      (SELECT COUNT(*)::int FROM candidate_decisions WHERE decision = 'TALENT_POOL') AS "talentPool",
      (SELECT AVG(ats_score)::float8 FROM resume_parses) AS "avgAtsScore"
  `);

  const onb = await safeRow<any>(db, sql`
    SELECT
      (SELECT COUNT(*)::int FROM onboarding_programs WHERE status = 'IN_PROGRESS') AS "activePrograms",
      (SELECT COUNT(*)::int FROM onboarding_programs WHERE status = 'COMPLETED') AS "completedPrograms",
      (SELECT COUNT(*)::int FROM certificates) AS "certificatesIssued"
  `);

  const att = await safeRow<any>(db, sql`
    SELECT
      (SELECT COUNT(*)::int FROM attendance_logs WHERE status = 'OPEN') AS "openLogsToday",
      (SELECT COUNT(*)::int FROM attendance_logs WHERE status = 'CLOSED' AND work_date = CURRENT_DATE) AS "closedLogsToday",
      (SELECT COUNT(*)::int FROM daily_timesheets WHERE approval_status = 'SUBMITTED') AS "pendingTimesheets",
      (SELECT COALESCE(SUM(total_overtime_hours),0)::float8 FROM attendance_records
        WHERE work_date >= date_trunc('month', CURRENT_DATE)) AS "overtimeHoursThisMonth"
  `);

  const pay = await safeRow<any>(db, sql`
    SELECT
      (SELECT period_code FROM payroll_runs ORDER BY period_start DESC LIMIT 1) AS "latestPeriod",
      (SELECT status::text FROM payroll_runs ORDER BY period_start DESC LIMIT 1) AS "latestStatus",
      (SELECT total_net::float8 FROM payroll_runs ORDER BY period_start DESC LIMIT 1) AS "latestTotalNet",
      (SELECT COUNT(*)::int FROM payroll_runs) AS "totalRuns"
  `);

  const lrn = await safeRow<any>(db, sql`
    SELECT
      (SELECT COUNT(*)::int FROM moodle_courses WHERE is_active = TRUE) AS "totalCourses",
      (SELECT COUNT(*)::int FROM moodle_course_enrollments) AS "enrollments",
      (SELECT COUNT(*)::int FROM moodle_course_enrollments WHERE completion_state = 'COMPLETE') AS "completions"
  `);

  const pe = await safeRow<any>(db, sql`
    SELECT
      (SELECT COUNT(*)::int FROM offboarding_requests WHERE status <> 'COMPLETED') AS "activeOffboardings",
      (SELECT COUNT(*)::int FROM knowledge_handovers WHERE is_verified = FALSE) AS "knowledgeHandoversPending",
      (SELECT COUNT(*)::int FROM severance_calculations WHERE is_paid = FALSE) AS "severancesPending",
      (SELECT COUNT(*)::int FROM lifetime_contributions) AS "totalLifetimeContributions"
  `);

  const enrollments = Number(lrn?.enrollments ?? 0);
  const completions = Number(lrn?.completions ?? 0);

  return {
    generatedAt: new Date().toISOString(),
    workforce: {
      total: Number(wf?.total ?? 0), permanent: Number(wf?.permanent ?? 0),
      probation: Number(wf?.probation ?? 0), contract: Number(wf?.contract ?? 0),
      resigned: Number(wf?.resigned ?? 0),
    },
    recruitment: {
      openPostings: Number(rec?.openPostings ?? 0), totalApplications: Number(rec?.totalApplications ?? 0),
      inReview: Number(rec?.inReview ?? 0), accepted: Number(rec?.accepted ?? 0),
      rejected: Number(rec?.rejected ?? 0), talentPool: Number(rec?.talentPool ?? 0),
      avgAtsScore: rec?.avgAtsScore != null ? Math.round(Number(rec.avgAtsScore) * 100) / 100 : null,
    },
    onboarding: {
      activePrograms: Number(onb?.activePrograms ?? 0), completedPrograms: Number(onb?.completedPrograms ?? 0),
      certificatesIssued: Number(onb?.certificatesIssued ?? 0),
    },
    attendance: {
      openLogsToday: Number(att?.openLogsToday ?? 0), closedLogsToday: Number(att?.closedLogsToday ?? 0),
      pendingTimesheets: Number(att?.pendingTimesheets ?? 0),
      overtimeHoursThisMonth: Math.round(Number(att?.overtimeHoursThisMonth ?? 0) * 100) / 100,
    },
    payroll: {
      latestPeriod: pay?.latestPeriod ?? null, latestStatus: pay?.latestStatus ?? null,
      latestTotalNet: pay?.latestTotalNet != null ? Number(pay.latestTotalNet) : null,
      totalRuns: Number(pay?.totalRuns ?? 0),
    },
    learning: {
      totalCourses: Number(lrn?.totalCourses ?? 0), enrollments, completions,
      completionRate: enrollments > 0 ? Math.round((completions / enrollments) * 100) : 0,
    },
    postEmployment: {
      activeOffboardings: Number(pe?.activeOffboardings ?? 0),
      knowledgeHandoversPending: Number(pe?.knowledgeHandoversPending ?? 0),
      severancesPending: Number(pe?.severancesPending ?? 0),
      totalLifetimeContributions: Number(pe?.totalLifetimeContributions ?? 0),
    },
  };
}

export interface ManagerDashboard {
  generatedAt: string;
  managerEmployeeId: string;
  team: {
    total: number;
    presentToday: number;
    onLeave: number;
  };
  approvals: {
    pendingTimesheets: number;
    pendingLeaveRequests: number;
  };
  performance: {
    avgGpa: number | null;
    nineBoxCounts: Record<string, number>;
  };
}

/** Ringkasan dashboard untuk seorang People Manager (tim langsung). */
export async function getManagerDashboard(db: Db, managerEmployeeId: string): Promise<ManagerDashboard> {
  const team = await safeRow<any>(db, sql`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM attendance_logs al WHERE al.employee_id = e.id AND al.work_date = CURRENT_DATE AND al.status = 'OPEN'
           ))::int AS "presentToday"
      FROM employees e WHERE e.manager_id = ${managerEmployeeId}::uuid
  `);

  const approvals = await safeRow<any>(db, sql`
    SELECT
      (SELECT COUNT(*)::int FROM daily_timesheets dt JOIN employees e ON e.id = dt.employee_id
        WHERE e.manager_id = ${managerEmployeeId}::uuid AND dt.approval_status = 'SUBMITTED') AS "pendingTimesheets",
      (SELECT COUNT(*)::int FROM leave_requests lr JOIN employees e ON e.id = lr.employee_id
        WHERE e.manager_id = ${managerEmployeeId}::uuid AND lr.status = 'SUBMITTED') AS "pendingLeaveRequests"
  `);

  const perf = await safeRow<any>(db, sql`
    SELECT AVG(pa.final_gpa)::float8 AS "avgGpa"
      FROM performance_appraisals pa JOIN employees e ON e.id = pa.employee_id
     WHERE e.manager_id = ${managerEmployeeId}::uuid
  `);

  const nb = (await db.execute(sql`
    SELECT pa.nine_box_quadrant::text AS quadrant, COUNT(*)::int AS n
      FROM performance_appraisals pa JOIN employees e ON e.id = pa.employee_id
     WHERE e.manager_id = ${managerEmployeeId}::uuid AND pa.nine_box_quadrant IS NOT NULL
     GROUP BY pa.nine_box_quadrant
  `).catch(() => ({ rows: [] }))) as unknown as { rows: Array<{ quadrant: string; n: number }> };
  const nineBoxCounts: Record<string, number> = {};
  (nb.rows ?? []).forEach((r) => { nineBoxCounts[r.quadrant] = Number(r.n); });

  // Cuti: karyawan tim yang sedang cuti hari ini.
  const onLeaveRow = await safeRow<any>(db, sql`
    SELECT COUNT(DISTINCT lr.employee_id)::int AS "onLeave"
      FROM leave_requests lr JOIN employees e ON e.id = lr.employee_id
     WHERE e.manager_id = ${managerEmployeeId}::uuid AND lr.status = 'APPROVED'
       AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
  `);

  return {
    generatedAt: new Date().toISOString(),
    managerEmployeeId,
    team: {
      total: Number(team?.total ?? 0),
      presentToday: Number(team?.presentToday ?? 0),
      onLeave: Number(onLeaveRow?.onLeave ?? 0),
    },
    approvals: {
      pendingTimesheets: Number(approvals?.pendingTimesheets ?? 0),
      pendingLeaveRequests: Number(approvals?.pendingLeaveRequests ?? 0),
    },
    performance: {
      avgGpa: perf?.avgGpa != null ? Math.round(Number(perf.avgGpa) * 100) / 100 : null,
      nineBoxCounts,
    },
  };
}

export interface PostEmploymentSummary {
  generatedAt: string;
  offboardings: Array<{
    id: string; employeeName: string; department: string; lastWorkingDay: string;
    status: string; isRegrettableAttrition: boolean; severanceTotal: number | null; isSeverancePaid: boolean | null;
  }>;
  leave: {
    pending: number;
    approvedThisYear: number;
    daysApprovedThisYear: number;
  };
  lifetimeContributions: {
    total: number;
    byType: Record<string, number>;
  };
}

/** Ringkasan pasca-kerja: exit clearance, cuti, dan warisan kontribusi (LCI). */
export async function getPostEmploymentSummary(db: Db): Promise<PostEmploymentSummary> {
  const off = (await db.execute(sql`
    SELECT o.id, e.full_name AS "employeeName", d.department_name AS department,
           o.last_working_day::text AS "lastWorkingDay", o.status,
           o.is_regrettable_attrition AS "isRegrettableAttrition",
           sc.total_disbursement::float8 AS "severanceTotal", sc.is_paid AS "isSeverancePaid"
      FROM offboarding_requests o
      JOIN employees e ON e.id = o.employee_id
      JOIN departments d ON d.id = e.department_id
      LEFT JOIN severance_calculations sc ON sc.offboarding_request_id = o.id
     ORDER BY o.last_working_day DESC
     LIMIT 50
  `).catch(() => ({ rows: [] }))) as unknown as { rows: any[] };

  const leave = await safeRow<any>(db, sql`
    SELECT
      (SELECT COUNT(*)::int FROM leave_requests WHERE status = 'SUBMITTED') AS pending,
      (SELECT COUNT(*)::int FROM leave_requests WHERE status = 'APPROVED'
        AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM CURRENT_DATE)) AS "approvedThisYear",
      (SELECT COALESCE(SUM(total_days),0)::int FROM leave_requests WHERE status = 'APPROVED'
        AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM CURRENT_DATE)) AS "daysApprovedThisYear"
  `);

  const lci = (await db.execute(sql`
    SELECT achievement_type AS "type", COUNT(*)::int AS n, COALESCE(SUM(quantified_impact_idr),0)::float8 AS value
      FROM lifetime_contributions GROUP BY achievement_type
  `).catch(() => ({ rows: [] }))) as unknown as { rows: Array<{ type: string; n: number; value: number }> };
  const byType: Record<string, number> = {};
  let total = 0;
  (lci.rows ?? []).forEach((r) => { byType[r.type] = Number(r.n); total += Number(r.n); });

  return {
    generatedAt: new Date().toISOString(),
    offboardings: (off.rows ?? []).map((r) => ({
      id: r.id, employeeName: r.employeeName, department: r.department,
      lastWorkingDay: r.lastWorkingDay, status: r.status,
      isRegrettableAttrition: !!r.isRegrettableAttrition,
      severanceTotal: r.severanceTotal != null ? Number(r.severanceTotal) : null,
      isSeverancePaid: r.isSeverancePaid ?? null,
    })),
    leave: {
      pending: Number(leave?.pending ?? 0),
      approvedThisYear: Number(leave?.approvedThisYear ?? 0),
      daysApprovedThisYear: Number(leave?.daysApprovedThisYear ?? 0),
    },
    lifetimeContributions: { total, byType },
  };
}
