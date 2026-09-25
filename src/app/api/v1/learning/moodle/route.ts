import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, fail } from '@/lib/api/response';
import { enrollMoodleCourse } from '@/lib/services/learningCareerService';
import { z } from 'zod';

const EnrollSchema = z.object({
  moodleCourseId: z.number().int().positive(),
  courseTitle: z.string().min(3),
});

export async function POST(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) {
    return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
  }

  try {
    const body = await req.json();
    const parsed = EnrollSchema.safeParse(body);
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    if (!session.employeeId) {
      return fail('FORBIDDEN', 'Akun pengguna ini tidak memiliki ID karyawan aktif.', 403);
    }

    const enrollment = await enrollMoodleCourse({
      employeeId: session.employeeId,
      moodleCourseId: parsed.data.moodleCourseId,
      courseTitle: parsed.data.courseTitle,
    });

    return ok(enrollment, 'Pendaftaran kursus Moodle berhasil.');
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal mendaftar kursus', 500);
  }
}
