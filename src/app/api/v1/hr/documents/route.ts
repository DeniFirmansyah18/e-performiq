import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { listDocumentsForHr, type DocumentRow } from '@/lib/services/employeeDocumentService';

const VALID: Array<DocumentRow['verificationStatus']> = ['PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'];

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'document:verify');

    const raw = req.nextUrl.searchParams.get('status');
    if (raw && !VALID.includes(raw as DocumentRow['verificationStatus'])) {
      return fail('VALIDATION_ERROR', `Status '${raw}' tidak dikenal.`, 400);
    }

    const employeeId = req.nextUrl.searchParams.get('employeeId') ?? undefined;
    if (employeeId && !/^[0-9a-f-]{36}$/i.test(employeeId)) {
      return fail('VALIDATION_ERROR', 'employeeId harus UUID.', 400);
    }

    const items = await listDocumentsForHr(db, {
      status: (raw as DocumentRow['verificationStatus']) ?? undefined,
      employeeId,
    });
    return ok({ items, total: items.length });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat berkas', status);
  }
}
