import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { ok, fail, problem } from '@/lib/api/response';
import { verifyEmployeeEmail } from '@/lib/services/employeeRegistrationService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REASON_MESSAGE: Record<string, string> = {
  INVALID: 'Tautan verifikasi tidak valid.',
  EXPIRED: 'Tautan verifikasi telah kadaluarsa. Silakan daftar ulang.',
  ALREADY: 'Email sudah diverifikasi sebelumnya.',
};

// GET /api/v1/employee/verify?token= — verifikasi email (PUBLIK).
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token') ?? '';
    if (!token) return fail('VALIDATION_ERROR', 'Token verifikasi wajib diisi.', 400);
    const result = await verifyEmployeeEmail(db, token);
    if (!result.ok) {
      return fail('VERIFY_FAILED', REASON_MESSAGE[result.reason] ?? 'Verifikasi gagal.', 400);
    }
    return ok({ ok: true, email: result.email });
  } catch (err) {
    return problem(err, '/api/v1/employee/verify');
  }
}
