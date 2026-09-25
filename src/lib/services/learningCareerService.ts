import { getDb } from '@/lib/db/client';
import type { CareerPathLevel, MoodleCourseEnrollment } from '@/types';

export interface SkillGapItem {
  skill: string;
  required: number;
  actual: number;
  gap: number;
}

export interface MoodleCourseCatalogItem {
  courseId: number;
  title: string;
  targetSkill: string;
}

/**
 * Mencocokkan modul Moodle yang relevan dengan kesenjangan kompetensi individu
 */
export function matchCoursesToSkillGaps(
  gaps: SkillGapItem[],
  catalog: MoodleCourseCatalogItem[]
): MoodleCourseCatalogItem[] {
  // Hanya ambil skill yang memiliki gap positif (required > actual)
  const deficientSkills = new Set(
    gaps.filter((g) => g.gap > 0).map((g) => g.skill.toLowerCase())
  );

  return catalog.filter((c) =>
    deficientSkills.has(c.targetSkill.toLowerCase())
  );
}

/**
 * Mendaftarkan karyawan ke kursus pelatihan Moodle (Self-Enrollment Kotak 2)
 */
export async function enrollMoodleCourse(payload: {
  employeeId: string;
  moodleCourseId: number;
  courseTitle: string;
}): Promise<MoodleCourseEnrollment> {
  const db = await getDb();
  const res = await db.query<any>(
    `INSERT INTO moodle_course_enrollments (employee_id, moodle_course_id, course_title, completion_pct)
     VALUES ($1, $2, $3, 0.00)
     ON CONFLICT (employee_id, moodle_course_id)
     DO UPDATE SET course_title = EXCLUDED.course_title
     RETURNING *;`,
    [payload.employeeId, payload.moodleCourseId, payload.courseTitle]
  );

  const row = res.rows[0];
  return {
    id: row.id,
    employeeId: row.employee_id,
    moodleCourseId: row.moodle_course_id,
    courseTitle: row.course_title,
    completionPct: Number(row.completion_pct),
    score: row.score ? Number(row.score) : undefined,
    isCertified: Boolean(row.is_certified),
    enrolledAt: row.enrolled_at,
    completedAt: row.completed_at,
  };
}

/**
 * Mengambil peta jenjang karir (Ladder) berdasarkan posisi jabatan saat ini
 */
export async function getCareerPathForPosition(
  currentPositionId: string
): Promise<CareerPathLevel[]> {
  const db = await getDb();
  const res = await db.query<any>(
    `SELECT c.*, j.position_title as target_position_title
     FROM career_path_levels c
     JOIN job_positions j ON j.id = c.target_position_id
     WHERE c.job_position_id = $1;`,
    [currentPositionId]
  );

  return res.rows.map((row: any) => ({
    id: row.id,
    jobPositionId: row.job_position_id,
    targetPositionId: row.target_position_id,
    targetPositionTitle: row.target_position_title,
    minGpa: Number(row.min_gpa),
    minServiceMonths: Number(row.min_service_months),
    requiredSkills: row.required_skills ?? [],
  }));
}
