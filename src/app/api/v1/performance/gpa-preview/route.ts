import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem } from '@/lib/api/response';
import * as gpaDerivationService from '@/lib/services/gpaDerivationService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/performance/gpa-preview?employee_id=&period_id=
// Pratinjau derivation nilai (D5). TIDAK menulis apa pun.
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employee_id');
    const periodId = searchParams.get('period_id');

    if (!employeeId || !periodId) {
      return ok(null, 'employee_id dan period_id wajib diisi.');
    }

    const preview = await gpaDerivationService.previewGpaDerivation(db, session, employeeId, periodId);
    return ok(preview);
  } catch (err) {
    return problem(err, '/api/v1/performance/gpa-preview');
  }
}
