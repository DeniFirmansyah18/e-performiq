import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, failFromError, parseBody } from '@/lib/api/response';
import * as svc from '@/lib/services/postEmploymentService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AssetSchema = z.object({
  employee_id: z.string().uuid('employee_id harus berupa UUID'),
  asset_name: z.string().min(1, 'Nama aset wajib diisi').max(200),
  asset_category: z
    .enum(['LAPTOP', 'PHONE', 'ACCESS_CARD', 'VEHICLE', 'DOCUMENT', 'OTHER'])
    .optional(),
  asset_code: z.string().max(100).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

/** GET /api/v1/post-employment/clearance?employeeId=… — checklist serah terima. */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'postemployment:read');

    const employeeId = new URL(req.url).searchParams.get('employeeId');
    if (!employeeId) {
      return ok(
        {
          error: 'VALIDATION_ERROR',
          message: 'Parameter employeeId wajib diisi.',
        },
        { status: 400 }
      );
    }

    const overview = await svc.getClearanceOverview(db, employeeId);
    return ok(overview);
  } catch (err) {
    return failFromError(err, '/api/v1/post-employment/clearance');
  }
}

/** POST /api/v1/post-employment/clearance — tambah satu aset ke checklist. */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'postemployment:manage');
    const body = await parseBody(req, AssetSchema);

    const asset = await svc.addClearanceAsset(db, {
      employeeId: body.employee_id,
      assetName: body.asset_name,
      assetCategory: body.asset_category,
      assetCode: body.asset_code ?? null,
      notes: body.notes ?? null,
    });

    return ok(
      { message: 'Aset berhasil ditambahkan ke checklist serah terima.', data: asset },
      { status: 201 }
    );
  } catch (err) {
    return failFromError(err, '/api/v1/post-employment/clearance');
  }
}
