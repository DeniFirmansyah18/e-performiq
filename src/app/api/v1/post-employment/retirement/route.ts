import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, failFromError, parseBody } from '@/lib/api/response';
import * as svc from '@/lib/services/postEmploymentService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PlanSchema = z.object({
  employee_id: z.string().uuid('employee_id harus berupa UUID'),
  planned_retirement_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Tanggal pensiun tidak valid'),
  successor_employee_id: z.string().uuid().nullable().optional(),
  successor_readiness: z
    .enum(['READY_NOW', 'READY_1_YEAR', 'READY_2_YEAR', 'NOT_READY'])
    .optional(),
  knowledge_transfer_status: z
    .enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'])
    .optional(),
  notes: z.string().max(2000).nullable().optional(),
});

/** GET /api/v1/post-employment/retirement — daftar calon pensiun + ringkasan. */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'postemployment:read');

    const scope = new URL(req.url).searchParams.get('employeeId');

    if (scope) {
      const rows = (await db.execute(sql`
        SELECT rp.id,
               rp.employee_id AS "employeeId",
               rp.planned_retirement_date AS "plannedRetirementDate",
               rp.successor_employee_id AS "successorEmployeeId",
               rp.successor_readiness AS "successorReadiness",
               rp.knowledge_transfer_status AS "knowledgeTransferStatus",
               rp.notes,
               rp.updated_at AS "updatedAt"
          FROM retirement_plans rp
         WHERE rp.employee_id = ${scope}::uuid
      `)) as unknown as { rows: any[] };
      return ok(rows.rows[0] ?? null);
    }

    const overview = await svc.getRetirementOverview(db);
    return ok(overview);
  } catch (err) {
    return failFromError(err, '/api/v1/post-employment/retirement');
  }
}

/** POST /api/v1/post-employment/retirement — simpan/ubah rencana pensiun. */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'postemployment:manage');
    const body = await parseBody(req, PlanSchema);

    const plan = await svc.upsertRetirementPlan(db, {
      employeeId: body.employee_id,
      plannedRetirementDate: body.planned_retirement_date,
      successorEmployeeId: body.successor_employee_id ?? null,
      successorReadiness: body.successor_readiness,
      knowledgeTransferStatus: body.knowledge_transfer_status,
      notes: body.notes ?? null,
    });

    return ok(
      { message: 'Rencana pensiun berhasil disimpan.', data: plan },
      { status: 201 }
    );
  } catch (err) {
    return failFromError(err, '/api/v1/post-employment/retirement');
  }
}
