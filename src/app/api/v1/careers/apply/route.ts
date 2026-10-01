import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { ok, fail, problem } from '@/lib/api/response';
import { submitApplication } from '@/lib/services/candidateService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Honeypot `website` harus kosong (bot mengisinya). Field lain divalidasi ketat.
const ApplySchema = z.object({
  fullName: z.string().min(2).max(200),
  email: z.string().email().max(150),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  birthDate: z.string().max(30).optional(),
  education: z.string().max(200).optional(),
  resumeUrl: z.string().max(500).optional(),
  coverLetter: z.string().max(4000).optional(),
  jobPostingId: z.string().uuid(),
  website: z.string().optional(),
});

// POST /api/v1/careers/apply  (PUBLIK - tanpa sesi)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = ApplySchema.safeParse(body);
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data lamaran tidak valid.', 400);
    }
    if (parsed.data.website && parsed.data.website.trim().length > 0) {
      return fail('BAD_REQUEST', 'Permintaan ditolak.', 400);
    }
    const result = await submitApplication(db, {
      fullName: parsed.data.fullName, email: parsed.data.email, phone: parsed.data.phone,
      address: parsed.data.address, birthDate: parsed.data.birthDate, education: parsed.data.education,
      resumeUrl: parsed.data.resumeUrl, coverLetter: parsed.data.coverLetter, jobPostingId: parsed.data.jobPostingId,
    });
    return ok(result, 'Lamaran berhasil dikirim.');
  } catch (err) {
    return problem(err, '/api/v1/careers/apply');
  }
}
