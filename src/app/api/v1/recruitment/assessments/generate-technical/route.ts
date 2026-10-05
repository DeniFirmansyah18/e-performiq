import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { generateTechnicalQuestions } from '@/lib/services/technicalTestGenerator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GenerateSchema = z.object({
  positionId: z.string().uuid(),
  count: z.number().int().min(1).max(20).optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  language: z.enum(['id', 'en']).optional(),
});

// POST /api/v1/recruitment/assessments/generate-technical  (HR)
// Generate soal tes teknis via AI untuk sebuah lowongan → disimpan sebagai DRAFT.
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:manage');
    const body = await req.json().catch(() => ({}));
    const parsed = GenerateSchema.safeParse(body);
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data generate tidak valid.', 400);
    }

    const result = await generateTechnicalQuestions(db, {
      positionId: parsed.data.positionId,
      count: parsed.data.count,
      difficulty: parsed.data.difficulty,
      language: parsed.data.language,
      generatedBy: session.userId,
    });

    const message =
      result.generated > 0
        ? `${result.generated} soal berhasil dibuat (status DRAFT, menunggu persetujuan HR).`
        : 'Tidak ada soal yang dihasilkan. AI tidak aktif atau keluaran tidak valid; silakan isi soal secara manual.';
    return ok(result, message);
  } catch (err) {
    return problem(err, '/api/v1/recruitment/assessments/generate-technical');
  }
}
