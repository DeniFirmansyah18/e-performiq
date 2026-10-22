import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { createStep, listStepsForHr } from '@/lib/services/careerLadderService';

const CreateSchema = z.object({
  fromPositionId: z.string().uuid(),
  toPositionId: z.string().uuid(),
  stepOrder: z.number().int().positive().max(50),
  stepName: z.string().min(3).max(200),
  requirementType: z.enum([
    'GPA', 'COMPETENCY', 'CERTIFICATION', 'TRAINING_HOURS', 'MOODLE_COURSE', 'TENURE',
  ]),
  requirementRef: z.string().max(200).nullable().optional(),
  thresholdValue: z.number().min(0).nullable().optional(),
  isMandatory: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'career:manage');

    const items = await listStepsForHr(db);
    return ok({ items, total: items.length });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat konfigurasi jenjang karir', status);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'career:manage');

    const parsed = CreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const row = await createStep(db, parsed.data);
    return ok(row, 'Tahapan karir ditambahkan.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(
      status === 422 ? 'BUSINESS_RULE_VIOLATION' : status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal menambah tahapan karir',
      status,
    );
  }
}
