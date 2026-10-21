import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { addDocument, isAllowedDocumentUrl, listDocuments } from '@/lib/services/employeeDocumentService';

const BodySchema = z.object({
  documentType: z.string().min(2).max(60),
  fileUrl: z.string().url().refine(isAllowedDocumentUrl, {
    message: 'Berkas harus PDF, JPG, atau PNG.',
  }),
  issuedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'document:read');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);
    return ok({ items: await listDocuments(db, session.employeeId) });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat berkas', status);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'document:write');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const row = await addDocument(db, { employeeId: session.employeeId, ...parsed.data });
    return ok(row, 'Berkas terunggah dan menunggu verifikasi HRD.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(
      status === 422 ? 'BUSINESS_RULE_VIOLATION' : status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal mengunggah berkas',
      status,
    );
  }
}
