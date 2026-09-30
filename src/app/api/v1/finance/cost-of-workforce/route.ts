import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem } from '@/lib/api/response';
import { calculateCostOfWorkforce } from '@/lib/services/payrollFinanceService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/finance/cost-of-workforce
// Kotak 5 Govera360 — Total Cost of Workforce (ISO 30414 Clause 4.6).
// Data gaji dikunci ke role berhak via 'payroll:read' (GCG).
export async function GET(req: NextRequest) {
try {
const session = await getAuthSession(req);
assertCan(session, 'payroll:read');



const payroll = await db.execute(sql`
  SELECT COALESCE(SUM(e.base_salary), 0) AS "totalPayroll"
    FROM employees e
   WHERE e.status IN ('PROBATION','PERMANENT','CONTRACT')
`);

const claims = await db.execute(sql`
  SELECT COALESCE(SUM(amount), 0) AS "totalClaims"
    FROM expense_claims
   WHERE status IN ('APPROVED','PAID')
`);

const output = await db.execute(sql`
  SELECT COALESCE(SUM(k.actual_value * k.kpi_weight / 100.0), 0) AS "totalOutput"
    FROM individual_kpis k
   WHERE k.status = 'APPROVED'
`);

const totalPayrollIDR = Number((payroll.rows as Array<{ totalPayroll: string }>)[0]?.totalPayroll ?? 0);
const totalClaimsIDR = Number((claims.rows as Array<{ totalClaims: string }>)[0]?.totalClaims ?? 0);
// Nilai output KPI dipakai apa adanya dalam rupiah agar satu satuan
// dengan payroll & klaim (tanpa pengali asumsi).
const totalOutputValueIDR = Number((output.rows as Array<{ totalOutput: string }>)[0]?.totalOutput ?? 0);

const result = calculateCostOfWorkforce({
  totalPayrollIDR,
  totalClaimsIDR,
  totalOutputValueIDR,
});

return ok(
  { ...result, breakdown: { totalPayrollIDR, totalClaimsIDR, totalOutputValueIDR } },
  'Cost of workforce berhasil dihitung.'
);
} catch (err) {
return problem(err, 'cost-of-workforce');
}
}
