import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { verifyPassword } from '@/lib/auth/password';
import { getPayslipDetail } from '@/lib/services/payrollService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PinSchema = z.object({ pin: z.string().min(4).max(10), runId: z.string().uuid().optional() });

// POST /api/v1/payroll/payslip — slip gaji karyawan (verifikasi PIN)
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'attendance:read'); // karyawan dapat mengakses slip miliknya sendiri
    if (!session.employeeId) return fail('FORBIDDEN', 'Sesi tidak terkait karyawan.', 403);

    const body = await req.json().catch(() => ({}));
    const parsed = PinSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'PIN wajib diisi.', 400);

    const pinRow = (await db.execute(sql`
      SELECT payslip_pin_hash AS "hash" FROM employees WHERE id = ${session.employeeId}::uuid
    `)) as unknown as { rows: Array<{ hash: string | null }> };
    const hash = pinRow.rows?.[0]?.hash;
    if (!hash) return fail('BUSINESS_RULE', 'PIN slip belum diatur. Hubungi HR.', 422);
    const valid = await verifyPassword(parsed.data.pin, hash);
    if (!valid) return fail('UNAUTHORIZED', 'PIN tidak valid.', 401);

    const payslip = await getPayslipDetail(db, session.employeeId, parsed.data.runId);
    if (!payslip) return fail('NOT_FOUND', 'Belum ada slip gaji yang diproses.', 404);
    return ok(payslip, 'Slip gaji berhasil diverifikasi.');
  } catch (err) {
    return problem(err, '/api/v1/payroll/payslip');
  }
}
