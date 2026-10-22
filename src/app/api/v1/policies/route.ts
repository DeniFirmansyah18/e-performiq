import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { isAllowedDocumentUrl } from '@/lib/services/employeeDocumentService';
import { listPolicies, publishByVersion } from '@/lib/services/policyService';

const PublishSchema = z.object({
  documentCode: z.string().min(3).max(60),
  title: z.string().min(3).max(255),
  policyType: z.enum(['SOP', 'PP', 'SK', 'IK']),
  version: z.string().min(1).max(20),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Dokumen lama boleh memakai URL eksternal; dokumen baru memakai storageKey. */
  fileUrl: z.string().url().refine(isAllowedDocumentUrl, {
    message: 'Berkas harus PDF, JPG, atau PNG.',
  }).optional(),
  storageKey: z.string().min(3).max(300).optional(),
  fileName: z.string().max(255).optional(),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024).optional(),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  scanStatus: z.enum(['CLEAN', 'INFECTED', 'SKIPPED']).optional(),
  scanEngine: z.string().max(40).optional(),
  pageCount: z.number().int().positive().nullable().optional(),
  ownerDepartmentId: z.string().uuid().optional(),
  supersedesVersion: z.string().max(20).optional(),
}).refine((v) => Boolean(v.fileUrl || v.storageKey), {
  message: 'Sertakan berkas (unggahan) atau URL berkas.',
  path: ['fileUrl'],
});

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'profile:read');
    if (!session.employeeId) return fail('FORBIDDEN', 'Akun tidak memiliki ID karyawan.', 403);

    return ok({ items: await listPolicies(db, session.employeeId) });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat dokumen', status);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'policy:manage');

    const parsed = PublishSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const row = await publishByVersion(db, { ...parsed.data, actorId: session.userId });
    return ok(row, `Versi ${row.version} diterbitkan.`);
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(
      status === 422 ? 'BUSINESS_RULE_VIOLATION' : status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal menerbitkan dokumen',
      status,
    );
  }
}
