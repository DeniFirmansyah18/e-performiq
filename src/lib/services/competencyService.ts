import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { deriveCompetencyRating, computeSkillGap } from '@/lib/engines/competency-evidence-engine';

export interface CompetencyProfileItem {
  id: string;
  name: string;
  framework: string | null;
  level: number;
  requiredLevel: number;
  gap: number;
  deficient: boolean;
}

/** Profil kompetensi karyawan (level rata-rata evidence vs level dibutuhkan). */
export async function getCompetencyProfile(db: Db, employeeId: string) {
  const res = (await db.execute(sql`
    SELECT k.id, k.name, f.name AS "framework",
           COALESCE(ROUND(AVG(e.rating))::int, 0) AS "level"
      FROM competencies k
      LEFT JOIN competency_frameworks f ON f.id = k.framework_id
      LEFT JOIN competency_evidence e ON e.competency_id = k.id AND e.employee_id = ${employeeId}::uuid
     GROUP BY k.id, k.name, f.name
     ORDER BY k.name
  `)) as unknown as { rows: Array<{ id: string; name: string; framework: string | null; level: number }> };

  const requiredLevel = 4;
  const competencies: CompetencyProfileItem[] = (res.rows ?? [])
    .filter((r) => Number(r.level) > 0) // hanya kompetensi yang punya evidence (null-safe)
    .map((r) => {
      const level = Number(r.level);
      const { gap, deficient } = computeSkillGap(requiredLevel, level);
      return { id: r.id, name: r.name, framework: r.framework, level, requiredLevel, gap, deficient };
    });

  return { employeeId, requiredLevel, competencies };
}

/** Menyimpan bukti kompetensi (upsert). */
export async function upsertCompetencyEvidence(
  db: Db,
  payload: {
    employeeId: string;
    competencyId: string;
    source: 'COURSE' | 'ACTIVITY' | 'MANUAL';
    courseId?: number | null;
    rating: number;
    notes?: string;
  }
) {
  const rating = Math.min(5, Math.max(1, Math.round(payload.rating)));
  await db.execute(sql`
    INSERT INTO competency_evidence (employee_id, competency_id, source, course_id, rating, action, notes)
    VALUES (${payload.employeeId}::uuid, ${payload.competencyId}::uuid, ${payload.source}::evidence_source_enum,
            ${payload.courseId ?? null}, ${rating}, 'LOG'::evidence_action_enum, ${payload.notes ?? null})
    ON CONFLICT (employee_id, competency_id, course_id) DO UPDATE SET rating = EXCLUDED.rating, notes = EXCLUDED.notes
  `);
  return { employeeId: payload.employeeId, competencyId: payload.competencyId, rating };
}

/** Rating turunan (dipakai unit lain / konsistensi). */
export { deriveCompetencyRating };
