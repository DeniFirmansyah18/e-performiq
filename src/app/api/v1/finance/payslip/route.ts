import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, fail } from '@/lib/api/response';
import { getVerifiedPayslip } from '@/lib/services/payrollFinanceService';
import { z } from 'zod';

const PinSchema = z.object({
  pin: z.string().length(6, 'PIN harus 6 digit angka'),
});

export async function POST(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) {
    return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
  }

  try {
    const body = await req.json();
    const parsed = PinSchema.safeParse(body);
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'PIN tidak valid', 400);
    }

    const payslip = await getVerifiedPayslip({
      employeeId: session.employeeId,
      pin: parsed.data.pin,
    });

    return ok(payslip, 'Slip gaji digital berhasil diverifikasi.');
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal mengakses slip gaji', 500);
  }
}
