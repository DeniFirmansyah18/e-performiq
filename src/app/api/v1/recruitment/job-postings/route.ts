import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { listHrPostings, createPosting, getPostingReference } from '@/lib/services/jobPostingService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PostingSchema = z.object({
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

// GET /api/v1/recruitment/job-postings — semua lowongan (HR) atau data referensi form
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:read');
    if (req.nextUrl.searchParams.get('reference') === '1') {
      const reference = await getPostingReference(db);
      return ok(reference);
    }
    const postings = await listHrPostings(db);
    return ok({ postings });
  } catch (err) {
    return problem(err, '/api/v1/recruitment/job-postings');
  }
}

// POST /api/v1/recruitment/job-postings — buat lowongan baru (HR)
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:manage');
    const body = await req.json().catch(() => ({}));
    const parsed = PostingSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data lowongan tidak valid.', 400);

    if (parsed.data.salaryMin != null && parsed.data.salaryMax != null && parsed.data.salaryMin > parsed.data.salaryMax) {
      return fail('VALIDATION_ERROR', 'Gaji minimum tidak boleh melebihi gaji maksimum.', 400);
    }
    const created = await createPosting(db, parsed.data);
    return ok(created, 'Lowongan berhasil dibuat.');
  } catch (err) {
    return problem(err, '/api/v1/recruitment/job-postings');
  }
}
