import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import {
  changeEmployeePhase,
  getEmployeePhase,
  listPhaseHistory,
} from '@/lib/services/employeePhaseService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z
  .object({
    newPhase: z.enum(['PRE', 'DURING', 'POST']),
    effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal efektif harus berformat YYYY-MM-DD.'),
    reason: z.string().min(5, 'Alasan perubahan fase wajib diisi (minimal 5 karakter).'),
    allowCorrection: z.boolean().optional(),
  })
  .strict();

// GET /api/v1/hr/employees/[id]/phase — fase aktif + riwayat transisinya (audit).
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'employment:read');

    const employee = await getEmployeePhase(db, params.id);
    if (!employee) return fail('NOT_FOUND', 'Karyawan tidak ditemukan.', 404);

    return ok({ ...employee, history: await listPhaseHistory(db, params.id) });
  } catch (err) {
    return problem(err, '/api/v1/hr/employees/[id]/phase');
  }
}

// PUT /api/v1/hr/employees/[id]/phase — pindahkan fase (state machine PRE → DURING → POST).
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'employment:manage');

    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid.', 400);
    }

    const employee = await changeEmployeePhase(db, {
      employeeId: params.id,
      newPhase: parsed.data.newPhase,
      effectiveDate: parsed.data.effectiveDate,
      reason: parsed.data.reason,
      decidedBy: session.userId,
      allowCorrection: parsed.data.allowCorrection,
    });
    return ok(employee, 'Fase karyawan diperbarui.');
  } catch (err) {
    return problem(err, '/api/v1/hr/employees/[id]/phase');
  }
}
