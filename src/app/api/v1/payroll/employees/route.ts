import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { listEmployeesForPayrollConfig, updateEmployeePayrollConfig } from '@/lib/services/payrollService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UpdateSchema = z.object({
  employeeId: z.string().uuid(),
  baseSalary: z.number().min(0).optional(),
  payslipPin: z.string().regex(/^\d{6}$/, 'PIN harus 6 digit angka.').nullable().optional(),
});

// GET /api/v1/payroll/employees — daftar karyawan + konfigurasi payroll (HR).
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'payroll:read');
    const employees = await listEmployeesForPayrollConfig(db);
    return ok({ employees });
  } catch (err) {
    return problem(err, '/api/v1/payroll/employees');
  }
}

// PATCH /api/v1/payroll/employees — atur gaji pokok / PIN slip per karyawan (HR).
export async function PATCH(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'payroll:manage');
    const body = await req.json().catch(() => ({}));
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid.', 400);
    const { employeeId, ...rest } = parsed.data;
    const changed = await updateEmployeePayrollConfig(db, employeeId, rest);
    if (!changed) return fail('VALIDATION_ERROR', 'Tidak ada field yang diubah.', 400);
    return ok({ employeeId }, 'Konfigurasi payroll karyawan diperbarui.');
  } catch (err) {
    return problem(err, '/api/v1/payroll/employees');
  }
}
