import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { getCompetencyProfile } from '@/lib/services/competencyService';
import { computeTrainingHours } from '@/lib/engines/training-hours-engine';
import { deriveCompetencyScore } from '@/lib/engines/competency-gpa-engine';

/**
 * Menurunkan skor kompetensi (DUR-03) seorang karyawan dari data LMS:
 * level kompetensi + total gap + jam pelatihan. Mengembalikan 0-100.
 *
 * `calculateCompositeGPA` TIDAK diubah: pemanggil cukup mengisi `competencyScore`
 * dengan nilai ini. Bila tidak ada data LMS, engine mengembalikan skor dasar (70),
 * sehingga perilaku lama tetap dapat dipertahankan dengan tetap memakai skor input.
 */
export async function deriveCompetencyScoreForEmployee(
  db: Db,
  employeeId: string,
  _periodId?: string
): Promise<number> {
  const profile = await getCompetencyProfile(db, employeeId);
  const competencyLevels = profile.competencies.map((c) => c.level);
  const gapSum = profile.competencies.reduce((s, c) => s + Math.max(0, c.gap), 0);

  const hoursRes = (await db.execute(sql`
    SELECT COALESCE(SUM(time_spent_minutes), 0)::int AS "minutes"
      FROM moodle_course_enrollments WHERE employee_id = ${employeeId}::uuid
  `)) as unknown as { rows: Array<{ minutes: number }> };
  const trainingHours = computeTrainingHours([{ timeSpentMinutes: Number(hoursRes.rows[0]?.minutes ?? 0) }]);

  // Ambang jam pelatihan dari benchmark bila tersedia (fallback 24 sesuai PRD §3.2).
  const bench = (await db.execute(sql`
    SELECT benchmark_value AS "v" FROM industry_benchmarks WHERE metric_code = 'TRAINING_HOURS_MIN'
  `)) as unknown as { rows: Array<{ v: string | number }> };
  const targetHours = bench.rows[0]?.v != null ? Number(bench.rows[0].v) : 24;

  return deriveCompetencyScore({ competencyLevels, gapSum, trainingHours, cfg: { targetHours } });
}
