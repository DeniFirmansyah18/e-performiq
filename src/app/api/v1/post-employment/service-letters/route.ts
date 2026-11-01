import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, failFromError, parseBody } from '@/lib/api/response';
import * as svc from '@/lib/services/postEmploymentService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IssueSchema = z.object({
  employee_id: z.string().uuid('employee_id harus berupa UUID'),
  letter_type: z.enum(['EXPERIENCE', 'REFERENCE', 'EMPLOYMENT']).optional(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Tanggal akhir tidak valid')
    .optional(),
  purpose: z.string().max(300).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

/** GET /api/v1/post-employment/service-letters?employeeId=… — daftar surat. */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'postemployment:read');

    const employeeId = new URL(req.url).searchParams.get('employeeId') ?? undefined;
    const letters = await svc.listServiceLetters(db, employeeId);
    return ok(letters);
  } catch (err) {
    return failFromError(err, '/api/v1/post-employment/service-letters');
  }
}

/** POST /api/v1/post-employment/service-letters — terbitkan surat keterangan. */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'postemployment:manage');
    const body = await parseBody(req, IssueSchema);

    const letter = await svc.issueServiceLetter(db, {
      employeeId: body.employee_id,
      letterType: body.letter_type,
      endDate: body.end_date,
      purpose: body.purpose ?? null,
      notes: body.notes ?? null,
      issuedBy: session.userId,
    });

    return ok(
      {
        message: `Surat ${letter.letterNumber} berhasil diterbitkan.`,
        data: { ...letter, letterTypeLabel: svc.LETTER_TYPE_LABEL[letter.letterType] ?? letter.letterType },
      },
      { status: 201 }
    );
  } catch (err) {
    return failFromError(err, '/api/v1/post-employment/service-letters');
  }
}
