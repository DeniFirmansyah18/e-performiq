import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { ok, fail, problem } from '@/lib/api/response';
import { submitApplication } from '@/lib/services/candidateService';
import { runAts } from '@/lib/services/atsService';
import { getCandidateSession } from '@/lib/auth/candidateSession';

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
  // Teks hasil ekstraksi berkas (dari /api/v1/careers/upload) untuk analisis ATS.
  resumeText: z.string().max(40000).optional(),
  resumeFileName: z.string().max(255).optional(),
  coverLetter: z.string().max(4000).optional(),
  jobPostingId: z.string().uuid(),
  website: z.string().optional(),
});

// POST /api/v1/careers/apply  (PUBLIK - tanpa sesi; kandidat login dihubungkan otomatis)
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

    // Hubungkan ke akun kandidat bila pengguna sedang login (cookie kandidat).
    const session = await getCandidateSession(req).catch(() => null);

    const result = await submitApplication(db, {
      fullName: parsed.data.fullName, email: parsed.data.email, phone: parsed.data.phone,
      address: parsed.data.address, birthDate: parsed.data.birthDate, education: parsed.data.education,
      resumeUrl: parsed.data.resumeUrl, coverLetter: parsed.data.coverLetter, jobPostingId: parsed.data.jobPostingId,
      accountId: session?.accountId ?? null,
    });

    // ATS: analisis resume bila ada teks. Tidak memblokir pengiriman lamaran.
    let ats: { score: number; matched: string[]; missing: string[] } | null = null;
    if (result.candidateId && parsed.data.resumeText && parsed.data.resumeText.trim().length >= 20) {
      try {
        const atsResult = await runAts(db, {
          candidateId: result.candidateId,
          applicationId: result.applicationId,
          jobPostingId: parsed.data.jobPostingId,
          resumeText: parsed.data.resumeText,
          fileName: parsed.data.resumeFileName,
          fileUrl: parsed.data.resumeUrl,
        });
        ats = { score: atsResult.score, matched: atsResult.matched, missing: atsResult.missing };
      } catch (err) {
        console.warn('[careers/apply] ATS gagal (diabaikan):', (err as Error)?.message);
      }
    }

    return ok({ ...result, ats }, 'Lamaran berhasil dikirim.');
  } catch (err) {
    return problem(err, '/api/v1/careers/apply');
  }
}
