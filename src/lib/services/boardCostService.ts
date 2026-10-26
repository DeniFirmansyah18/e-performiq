import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { listPayrollRuns } from './payrollService';
import { listSocialSecurityForHr } from './socialSecurityService';

export interface BoardCostOptions {
  runId?: string;
  page?: number;
  pageSize?: number;
}

export interface BoardCostEmployeeRow {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  departmentName: string;
  positionTitle: string;
  baseSalary: number;
  fixedAllowance: number;
  overtimePay: number;
  bpjsKesehatan: number;
  bpjsJht: number;
  bpjsJp: number;
  pph21: number;
  gross: number;
  totalDeductions: number;
  net: number;
  overtimeHours: number;
}

export interface BoardCostOverview {
  sampleSize: number;
  payroll: {
    runs: Array<{
      runId: string;
      periodCode: string;
      status: string;
      totalGross: number;
      totalDeductions: number;
      totalNet: number;
      employeeCount: number;
      approvedAt: string | null;
    }>;
    latest: {
      runId: string;
      periodCode: string;
      totalGross: number;
      totalNet: number;
    } | null;
    trend: Array<{ periodCode: string; totalNet: number; deltaPercentage: number | null }>;
  };
  employees: BoardCostEmployeeRow[];
  employeesPagination: { page: number; pageSize: number; total: number };
  bpjs: {
    totalRegistered: number;
    totalPending: number;
    totalMissing: number;
    byClass: Array<{ className: string; count: number }>;
    employees: Array<{
      employeeId: string;
      employeeCode: string;
      fullName: string;
      bpjsTkNumberMasked: string | null;
      bpjsKesNumberMasked: string | null;
      bpjsKesClass: string | null;
      bpjsTkStatus: string;
      bpjsKesStatus: string;
    }>;
  };
  overtime: {
    totalHours: number;
    totalPay: number;
    pendingApprovals: number;
    byDepartment: Array<{ departmentName: string; hours: number; pay: number }>;
  };
  operational: {
    totalAmount: number;
    byCategory: Array<{ category: string; count: number; amount: number }>;
    byStatus: Array<{ status: string; count: number; amount: number }>;
  };
  analysis: {
    costPerEmployee: number;
    topDecileCostShare: number;
    payrollGrowthPercentage: number | null;
    highlights: string[];
  };
}

const DEFAULT_PAGE_SIZE = 50;

function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export async function getBoardCostOverview(
  db: Db,
  options: BoardCostOptions = {}
): Promise<BoardCostOverview> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, options.pageSize ?? DEFAULT_PAGE_SIZE));

  const runs = (await listPayrollRuns(db, 12)) as Array<{
    id: string;
    periodCode: string;
    status: string;
    totalGross: number;
    totalDeductions: number;
    totalNet: number;
    approvedAt: unknown;
  }>;

  const selectedRunId = options.runId ?? (runs.length > 0 ? String(runs[0].id) : null);
  const selectedRun = selectedRunId
    ? runs.find((r) => String(r.id) === selectedRunId) ?? null
    : null;

  // Jumlah item per run dihitung sekali, bukan ditebak atau diisi 0.
  const runCountsRes = (await db.execute(sql`
    SELECT run_id AS "runId", COUNT(*)::int AS total
      FROM payroll_items
     GROUP BY run_id
  `)) as unknown as { rows: Array<{ runId: string; total: number }> };
  const runCounts = new Map(
    (runCountsRes.rows ?? []).map((r) => [String(r.runId), Number(r.total)])
  );

  const countRes = (await db.execute(sql`
    SELECT COUNT(*)::int AS total
      FROM payroll_items
     WHERE ${selectedRunId ? sql`run_id = ${selectedRunId}::uuid` : sql`FALSE`}
  `)) as unknown as { rows: Array<{ total: number }> };
  const totalEmployees = Number(countRes.rows?.[0]?.total ?? 0);

  const itemsRes = (await db.execute(sql`
    SELECT pi.employee_id AS "employeeId", e.employee_code AS "employeeCode",
           e.full_name AS "fullName", d.department_name AS "departmentName",
           jp.position_title AS "positionTitle",
           pi.base_salary::float8 AS "baseSalary",
           pi.fixed_allowance::float8 AS "fixedAllowance",
           pi.overtime_pay::float8 AS "overtimePay",
           pi.bpjs_kesehatan::float8 AS "bpjsKesehatan",
           pi.bpjs_jht::float8 AS "bpjsJht",
           pi.bpjs_jp::float8 AS "bpjsJp",
           pi.pph21::float8 AS "pph21",
           pi.gross::float8 AS gross,
           pi.total_deductions::float8 AS "totalDeductions",
           pi.net::float8 AS net,
           pi.overtime_hours::float8 AS "overtimeHours"
      FROM payroll_items pi
      JOIN employees e ON e.id = pi.employee_id
      JOIN departments d ON d.id = e.department_id
      JOIN job_positions jp ON jp.id = e.position_id
     WHERE ${selectedRunId ? sql`pi.run_id = ${selectedRunId}::uuid` : sql`FALSE`}
     ORDER BY pi.net DESC
     LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
  `)) as unknown as { rows: BoardCostEmployeeRow[] };

  const employees = (itemsRes.rows ?? []).map((r) => ({
    ...r,
    baseSalary: Number(r.baseSalary),
    fixedAllowance: Number(r.fixedAllowance),
    overtimePay: Number(r.overtimePay),
    bpjsKesehatan: Number(r.bpjsKesehatan),
    bpjsJht: Number(r.bpjsJht),
    bpjsJp: Number(r.bpjsJp),
    pph21: Number(r.pph21),
    gross: Number(r.gross),
    totalDeductions: Number(r.totalDeductions),
    net: Number(r.net),
    overtimeHours: Number(r.overtimeHours),
  }));

  // Konsentrasi biaya: porsi total net yang dipegang 10% pegawai termahal.
  const decileRes = (await db.execute(sql`
    WITH ranked AS (
      SELECT net::float8 AS net,
             NTILE(10) OVER (ORDER BY net DESC) AS decile
        FROM payroll_items
       WHERE ${selectedRunId ? sql`run_id = ${selectedRunId}::uuid` : sql`FALSE`}
    )
    SELECT COALESCE(SUM(net), 0)::float8 AS total,
           COALESCE(SUM(CASE WHEN decile = 1 THEN net ELSE 0 END), 0)::float8 AS top
      FROM ranked
  `)) as unknown as { rows: Array<{ total: number; top: number }> };
  const decile = decileRes.rows?.[0];
  const totalNetAll = Number(decile?.total ?? 0);
  const topNet = Number(decile?.top ?? 0);

  // Trend diurutkan lama -> baru agar delta mudah dibaca.
  const chronological = [...runs].reverse();
  const trend = chronological.map((run, idx) => {
    const prev = idx > 0 ? Number(chronological[idx - 1].totalNet) : null;
    const current = Number(run.totalNet);
    return {
      periodCode: run.periodCode,
      totalNet: current,
      deltaPercentage:
        prev !== null && prev > 0 ? round2(((current - prev) / prev) * 100) : null,
    };
  });
  const payrollGrowthPercentage =
    trend.length >= 2 ? trend[trend.length - 1].deltaPercentage : null;

  const overtimeRes = (await db.execute(sql`
    SELECT d.department_name AS "departmentName",
           COALESCE(SUM(pi.overtime_hours), 0)::float8 AS hours,
           COALESCE(SUM(pi.overtime_pay), 0)::float8 AS pay
      FROM payroll_items pi
      JOIN employees e ON e.id = pi.employee_id
      JOIN departments d ON d.id = e.department_id
     WHERE ${selectedRunId ? sql`pi.run_id = ${selectedRunId}::uuid` : sql`FALSE`}
     GROUP BY d.department_name
     ORDER BY hours DESC
  `)) as unknown as {
    rows: Array<{ departmentName: string; hours: number; pay: number }>;
  };

  const pendingRes = (await db.execute(sql`
    SELECT COUNT(*)::int AS total FROM overtime_requests WHERE status = 'SUBMITTED'
  `)) as unknown as { rows: Array<{ total: number }> };

  const opRes = (await db.execute(sql`
    SELECT claim_category AS category, COUNT(*)::int AS count, SUM(amount)::float8 AS amount
      FROM expense_claims GROUP BY claim_category ORDER BY amount DESC
  `)) as unknown as {
    rows: Array<{ category: string; count: number; amount: number }>;
  };
  const opStatusRes = (await db.execute(sql`
    SELECT status, COUNT(*)::int AS count, SUM(amount)::float8 AS amount
      FROM expense_claims GROUP BY status ORDER BY amount DESC
  `)) as unknown as {
    rows: Array<{ status: string; count: number; amount: number }>;
  };

  // Nomor BPJS sudah ter-masking di service sumber; jangan pernah membuka di sini.
  const bpjsRows = await listSocialSecurityForHr(db);
  const byClassMap = new Map<string, number>();
  for (const row of bpjsRows) {
    if (!row.registered) continue;
    const key = row.bpjsKesClass ?? 'Tidak diketahui';
    byClassMap.set(key, (byClassMap.get(key) ?? 0) + 1);
  }

  const overtimeHours = (overtimeRes.rows ?? []).reduce((s, r) => s + Number(r.hours), 0);
  const overtimePay = (overtimeRes.rows ?? []).reduce((s, r) => s + Number(r.pay), 0);
  const operationalTotal = (opRes.rows ?? []).reduce((s, r) => s + Number(r.amount), 0);

  const costPerEmployee = totalEmployees > 0 ? round2(totalNetAll / totalEmployees) : 0;
  const topDecileCostShare =
    totalNetAll > 0 ? Math.round((topNet / totalNetAll) * 1000) / 10 : 0;

  const pendingApprovals = Number(pendingRes.rows?.[0]?.total ?? 0);

  const highlights: string[] = [];
  if (!selectedRun) {
    highlights.push('Belum ada run payroll sehingga rincian biaya belum tersedia.');
  } else {
    highlights.push(
      `Payroll ${selectedRun.periodCode}: net ${totalNetAll.toLocaleString('id-ID')} untuk ${totalEmployees} pegawai.`
    );
    if (topDecileCostShare > 0) {
      highlights.push(`10% pegawai termahal menyerap ${topDecileCostShare}% total biaya.`);
    }
    if (payrollGrowthPercentage !== null) {
      const direction = payrollGrowthPercentage >= 0 ? 'naik' : 'turun';
      highlights.push(
        `Biaya payroll ${direction} ${Math.abs(payrollGrowthPercentage)}% dibanding periode sebelumnya.`
      );
    }
    if (pendingApprovals > 0) {
      highlights.push(`${pendingApprovals} pengajuan lembur menunggu persetujuan.`);
    }
  }

  return {
    sampleSize: totalEmployees,
    payroll: {
      runs: runs.map((r) => ({
        runId: String(r.id),
        periodCode: r.periodCode,
        status: r.status,
        totalGross: Number(r.totalGross),
        totalDeductions: Number(r.totalDeductions),
        totalNet: Number(r.totalNet),
        employeeCount: runCounts.get(String(r.id)) ?? 0,
        approvedAt: r.approvedAt ? new Date(r.approvedAt as string).toISOString() : null,
      })),
      latest: selectedRun
        ? {
            runId: String(selectedRun.id),
            periodCode: selectedRun.periodCode,
            totalGross: Number(selectedRun.totalGross),
            totalNet: Number(selectedRun.totalNet),
          }
        : null,
      trend,
    },
    employees,
    employeesPagination: { page, pageSize, total: totalEmployees },
    bpjs: {
      totalRegistered: bpjsRows.filter((r) => r.registered).length,
      totalPending: bpjsRows.filter(
        (r) => r.registered && (r.bpjsTkStatus === 'PENDING' || r.bpjsKesStatus === 'PENDING')
      ).length,
      totalMissing: bpjsRows.filter((r) => !r.registered).length,
      byClass: Array.from(byClassMap.entries()).map(([className, count]) => ({ className, count })),
      employees: bpjsRows.map((r) => ({
        employeeId: r.employeeId,
        employeeCode: r.employeeCode,
        fullName: r.employeeName,
        bpjsTkNumberMasked: r.bpjsTkNumber,
        bpjsKesNumberMasked: r.bpjsKesNumber,
        bpjsKesClass: r.bpjsKesClass,
        bpjsTkStatus: r.bpjsTkStatus,
        bpjsKesStatus: r.bpjsKesStatus,
      })),
    },
    overtime: {
      totalHours: overtimeHours,
      totalPay: overtimePay,
      pendingApprovals,
      byDepartment: (overtimeRes.rows ?? []).map((r) => ({
        departmentName: r.departmentName,
        hours: Number(r.hours),
        pay: Number(r.pay),
      })),
    },
    operational: {
      totalAmount: operationalTotal,
      byCategory: (opRes.rows ?? []).map((r) => ({
        category: r.category,
        count: Number(r.count),
        amount: Number(r.amount),
      })),
      byStatus: (opStatusRes.rows ?? []).map((r) => ({
        status: r.status,
        count: Number(r.count),
        amount: Number(r.amount),
      })),
    },
    analysis: {
      costPerEmployee,
      topDecileCostShare,
      payrollGrowthPercentage,
      highlights,
    },
  };
}
