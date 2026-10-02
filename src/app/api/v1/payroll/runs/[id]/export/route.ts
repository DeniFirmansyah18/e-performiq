import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { fail, problem } from '@/lib/api/response';
import { listPayrollItems } from '@/lib/services/payrollService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /api/v1/payroll/runs/:id/export — unduh rincian run sebagai CSV (HR)
export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'payroll:read');
    const items = await listPayrollItems(db, ctx.params.id);
    if (items.length === 0) return fail('NOT_FOUND', 'Run payroll tidak ditemukan atau kosong.', 404);

    const headers = [
      'employeeCode', 'fullName', 'department', 'baseSalary', 'fixedAllowance', 'overtimePay',
      'bonus', 'thr', 'bpjsKesehatan', 'bpjsJht', 'bpjsJp', 'pph21', 'gross', 'totalDeductions', 'net',
    ];
    const rows = items.map((r: any) => headers.map((h) => csvCell(r[h])).join(','));
    const csv = [headers.join(','), ...rows].join('\n');

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="payroll-${ctx.params.id}.csv"`,
      },
    });
  } catch (err) {
    return problem(err, '/api/v1/payroll/runs/[id]/export');
  }
}
