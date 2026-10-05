import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { ok, fail, problem } from '@/lib/api/response';
import { submitApplication } from '@/lib/services/candidateService';
import { runAts } from '@/lib/services/atsService';
import { getCandidateSessionOrNull } from '@/lib/auth/candidateSession';
import { notifyApplicationSubmitted } from '@/lib/services/notificationService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EducationSchema = z.object({
  level: z.string().max(10).nullable().optional(),
  institution: z.string().max(200).nullable().optional(),
  institutionCode: z.string().max(30).nullable().optional(),
  degree: z.string().max(120).nullable().optional(),
  major: z.string().max(120).nullable().optional(),
  startYear: z.number().int().min(1950).max(2100).nullable().optional(),
  endYear: z.number().int().min(1950).max(2100).nullable().optional(),
  graduationStatus: z.string().max(20).nullable().optional(),
  gpa: z.number().min(0).max(4).nullable().optional(),
});

const ExperienceSchema = z.object({
  experienceType: z.enum(['MAGANG', 'KERJA']).nullable().optional(),
  roleTitle: z.string().max(150).nullable().optional(),
  company: z.string().max(200).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  startMonth: z.number().int().min(1).max(12).nullable().optional(),
  startYear: z.number().int().min(1950).max(2100).nullable().optional(),
  endMonth: z.number().int().min(1).max(12).nullable().optional(),
  endYear: z.number().int().min(1950).max(2100).nullable().optional(),
  isCurrent: z.boolean().nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
});

const CertificationSchema = z.object({
  kind: z.enum(['CERTIFICATION', 'AWARD']).nullable().optional(),
  name: z.string().min(1).max(255),
  issuer: z.string().max(255).nullable().optional(),
  issuedDate: z.string().max(30).nullable().optional(),
  expiryDate: z.string().max(30).nullable().optional(),
  credentialId: z.string().max(120).nullable().optional(),
  proofUrl: z.string().max(2_000_000).nullable().optional(),
});

const DocumentSchema = z.object({
  docType: z.enum(['CV', 'COVER_LETTER', 'CERTIFICATE', 'OTHER']),
  fileName: z.string().max(255).nullable().optional(),
  mimeType: z.string().max(120).nullable().optional(),
  fileUrl: z.string().max(2_000_000),
});

const ApplySchema = z.object({
  fullName: z.string().min(2).max(200),
  email: z.string().email().max(150),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  birthDate: z.string().max(30).optional(),
  gender: z.enum(['LAKI_LAKI', 'PEREMPUAN']).optional(),
  nik: z.string().max(20).optional(),
  education: z.string().max(200).optional(),
  resumeUrl: z.string().max(500).optional(),
  resumeText: z.string().max(40000).optional(),
  resumeFileName: z.string().max(255).optional(),
  coverLetter: z.string().max(4000).optional(),
  educations: z.array(EducationSchema).max(10).optional(),
  experiences: z.array(ExperienceSchema).max(15).optional(),
  noExperience: z.boolean().optional(),
  certifications: z.array(CertificationSchema).max(15).optional(),
  documents: z.array(DocumentSchema).max(10).optional(),
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

    const session = await getCandidateSessionOrNull(req);

    const result = await submitApplication(db, {
      fullName: parsed.data.fullName, email: parsed.data.email, phone: parsed.data.phone,
      address: parsed.data.address, birthDate: parsed.data.birthDate, gender: parsed.data.gender,
      nik: parsed.data.nik, education: parsed.data.education,
      resumeUrl: parsed.data.resumeUrl, coverLetter: parsed.data.coverLetter, jobPostingId: parsed.data.jobPostingId,
      accountId: session?.accountId ?? null,
      educations: parsed.data.educations, experiences: parsed.data.experiences,
      noExperience: parsed.data.noExperience, certifications: parsed.data.certifications,
      documents: parsed.data.documents,
    });

    let ats: { score: number; matched: string[]; missing: string[]; cosine?: number } | null = null;
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
        ats = { score: atsResult.score, matched: atsResult.matched, missing: atsResult.missing, cosine: atsResult.cosine };
      } catch (err) {
        console.warn('[careers/apply] ATS gagal (diabaikan):', (err as Error)?.message);
      }
    }

    let notifications: { email: string; whatsapp: string } = { email: 'SKIPPED', whatsapp: 'SKIPPED' };
    try {
      notifications = await notifyApplicationSubmitted(db, {
        candidateId: result.candidateId,
        accountId: session?.accountId ?? null,
        applicationId: result.applicationId,
        email: parsed.data.email,
        name: parsed.data.fullName,
        applicationNo: result.applicationNo,
        phone: parsed.data.phone ?? null,
      });
      if (notifications.email === 'FAILED') console.warn('[careers/apply] email gagal untuk', result.applicationNo);
      if (notifications.whatsapp === 'FAILED') console.warn('[careers/apply] WhatsApp gagal untuk', result.applicationNo);
    } catch (err) {
      console.warn('[careers/apply] notifikasi error:', (err as Error)?.message);
      notifications = { email: 'ERROR', whatsapp: 'ERROR' };
    }

    return ok({ ...result, ats, notifications }, 'Lamaran berhasil dikirim.');
  } catch (err) {
    return problem(err, '/api/v1/careers/apply');
  }
}
