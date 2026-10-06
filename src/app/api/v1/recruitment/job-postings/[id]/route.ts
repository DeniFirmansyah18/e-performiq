import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { updatePosting, setPostingStatus } from '@/lib/services/jobPostingService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UpdateSchema = z.object({
  postingTitle: z.string().min(3).max(255),
  description: z.string().min(10).max(8000),
  requiredSkills: z.array(z.string().max(120)).max(30).default([]),
  departmentId: z.string().uuid(),
  positionId: z.string().uuid(),
  manpowerPlanId: z.string().uuid(),
  status: z.enum(['DRAFT', 'OPEN', 'CLOSED', 'FILLED']).optional(),
  isPublic: z.boolean().optional(),
  minEducation: z.string().max(100).nullable().optional(),
  minExperienceYears: z.number().min(0).max(50).nullable().optional(),
  workLocation: z.string().max(150).nullable().optional(),
  salaryMin: z.number().min(0).nullable().optional(),
  salaryMax: z.number().min(0).nullable().optional(),
  employmentType: z.string().max(30).nullable().optional(),
  quota: z.number().int().min(0).max(10000).nullable().optional(),
});

const StatusSchema = z.object({
  status: z.enum(['DRAFT', 'OPEN', 'CLOSED', 'FILLED']),
  isPublic: z.boolean().optional(),
});

// PATCH /api/v1/recruitment/job-postings/:id — ubah lowongan atau status saja (HR)
export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:manage');
    const body = await req.json().catch(() => ({}));

    // Mode 1: ubah status/publikasi saja (body hanya {status, isPublic?}).
    const statusOnly = StatusSchema.safeParse(body);
    if (statusOnly.success && Object.keys(body).length <= 2) {
      const okFlag = await setPostingStatus(db, ctx.params.id, statusOnly.data.status, statusOnly.data.isPublic);
      if (!okFlag) return fail('NOT_FOUND', 'Lowongan tidak ditemukan.', 404);
      return ok({ id: ctx.params.id, status: statusOnly.data.status }, 'Status lowongan diperbarui.');
    }

    // Mode 2: ubah seluruh field.
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data lowongan tidak valid.', 400);
    if (parsed.data.salaryMin != null && parsed.data.salaryMax != null && parsed.data.salaryMin > parsed.data.salaryMax) {
      return fail('VALIDATION_ERROR', 'Gaji minimum tidak boleh melebihi gaji maksimum.', 400);
    }
    const okFlag = await updatePosting(db, ctx.params.id, parsed.data);
    if (!okFlag) return fail('NOT_FOUND', 'Lowongan tidak ditemukan.', 404);
    return ok({ id: ctx.params.id }, 'Lowongan diperbarui.');
  } catch (err) {
    return problem(err, '/api/v1/recruitment/job-postings/[id]');
  }
}
