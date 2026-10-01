import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem } from '@/lib/api/response';
import { matchCoursesToSkillGaps, type MoodleCourseCatalogItem } from '@/lib/services/learningCareerService';
import { getCompetencyProfile } from '@/lib/services/competencyService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/learning/recommendations - kursus direkomendasikan dari skill-gap karyawan.
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:read');
    const employeeId = session.employeeId;
    if (!employeeId) return ok({ recommendations: [] });

    const profile = await getCompetencyProfile(db, employeeId);
    const gaps = profile.competencies
      .filter((c) => c.deficient)
      .map((c) => ({ skill: c.name, required: c.requiredLevel, actual: c.level, gap: c.gap }));

    // Katalog kursus dipetakan ke kompetensi target (course_competencies -> competencies.name).
    const catalogRes = (await db.execute(sql`
      SELECT c.id AS "courseId", c.title, k.name AS "targetSkill"
        FROM course_competencies cc
        JOIN moodle_courses c ON c.id = cc.course_id
        JOIN competencies k ON k.id = cc.competency_id
       WHERE c.is_active = TRUE
    `)) as unknown as { rows: MoodleCourseCatalogItem[] };

    const recommendations = matchCoursesToSkillGaps(gaps, catalogRes.rows ?? []);
    return ok({ recommendations, gapCount: gaps.length });
  } catch (err) {
    return problem(err, '/api/v1/learning/recommendations');
  }
}
