import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export type RequirementType =
  | 'GPA' | 'COMPETENCY' | 'CERTIFICATION' | 'TRAINING_HOURS' | 'MOODLE_COURSE' | 'TENURE';

export interface LadderStepResult {
  stepId: string;
  stepName: string;
  requirementType: RequirementType;
  threshold: number | null;
  actual: number;
  met: boolean;
  targetPositionId: string;
}

export interface ReadinessResult {
  targetPositionId: string | null;
  percent: number;
  met: number;
  total: number;
}

/**
 * Nilai nyata untuk satu jenis syarat. Semua query mengembalikan 0 bila data
 * tidak ada — syarat tidak pernah dianggap terpenuhi secara default.
 */
async function actualFor(
  db: Db,
  employeeId: string,
  type: RequirementType,
  ref: string | null,
): Promise<number> {
  switch (type) {
    case 'GPA': {
      const res = (await db.execute(sql`
        SELECT composite_gpa::float8 AS v FROM performance_appraisals
         WHERE employee_id = ${employeeId}::uuid
         ORDER BY created_at DESC LIMIT 1
      `)) as unknown as { rows: Array<{ v: number | null }> };
      return Number(res.rows?.[0]?.v ?? 0);
    }
    case 'COMPETENCY': {
      const res = (await db.execute(sql`
        SELECT COALESCE(avg(score), 0)::float8 AS v FROM competency_scores
         WHERE employee_id = ${employeeId}::uuid
           AND (${ref ?? null}::text IS NULL OR skill_name = ${ref ?? null})
      `)) as unknown as { rows: Array<{ v: number }> };
      return Number(res.rows?.[0]?.v ?? 0);
    }
    case 'CERTIFICATION': {
      const res = (await db.execute(sql`
        SELECT count(*)::int AS v
          FROM certificates c
          JOIN moodle_courses mc ON mc.id = c.course_id
         WHERE c.employee_id = ${employeeId}::uuid
           AND (${ref ?? null}::text IS NULL OR mc.title ILIKE '%' || ${ref ?? null} || '%')
      `)) as unknown as { rows: Array<{ v: number }> };
      return Number(res.rows?.[0]?.v ?? 0);
    }
    case 'TRAINING_HOURS': {
      const res = (await db.execute(sql`
        SELECT COALESCE(sum(mc.default_hours), 0)::float8 AS v
          FROM course_completions cc
          JOIN moodle_courses mc ON mc.id = cc.course_id
         WHERE cc.employee_id = ${employeeId}::uuid
      `)) as unknown as { rows: Array<{ v: number }> };
      return Number(res.rows?.[0]?.v ?? 0);
    }
    case 'MOODLE_COURSE': {
      const res = (await db.execute(sql`
        SELECT count(*)::int AS v FROM course_completions
         WHERE employee_id = ${employeeId}::uuid
           AND (${ref ?? null}::text IS NULL OR course_id::text = ${ref ?? null})
      `)) as unknown as { rows: Array<{ v: number }> };
      return Number(res.rows?.[0]?.v ?? 0);
    }
    case 'TENURE': {
      const res = (await db.execute(sql`
        SELECT GREATEST(0, (EXTRACT(YEAR FROM age(CURRENT_DATE, join_date)) * 12
                          + EXTRACT(MONTH FROM age(CURRENT_DATE, join_date))))::float8 AS v
          FROM employees WHERE id = ${employeeId}::uuid
      `)) as unknown as { rows: Array<{ v: number }> };
      return Number(res.rows?.[0]?.v ?? 0);
    }
    default:
      return 0;
  }
}

export async function listLadder(db: Db, employeeId: string): Promise<LadderStepResult[]> {
  const steps = (await db.execute(sql`
    SELECT s.id AS "stepId", s.step_name AS "stepName",
           s.requirement_type AS "requirementType", s.requirement_ref AS ref,
           s.threshold_value::float8 AS threshold,
           s.is_mandatory AS "isMandatory", s.to_position_id AS "targetPositionId"
      FROM career_ladder_steps s
      JOIN employees e ON e.position_id = s.from_position_id
     WHERE e.id = ${employeeId}::uuid
     ORDER BY s.step_order
  `)) as unknown as {
    rows: Array<{
      stepId: string; stepName: string; requirementType: RequirementType;
      ref: string | null; threshold: number | null; isMandatory: boolean; targetPositionId: string;
    }>;
  };

  const out: LadderStepResult[] = [];
  for (const s of steps.rows ?? []) {
    const actual = await actualFor(db, employeeId, s.requirementType, s.ref);
    out.push({
      stepId: s.stepId,
      stepName: s.stepName,
      requirementType: s.requirementType,
      threshold: s.threshold,
      actual,
      met: s.threshold === null ? actual > 0 : actual >= Number(s.threshold),
      targetPositionId: s.targetPositionId,
    });
  }
  return out;
}

export async function readiness(db: Db, employeeId: string): Promise<ReadinessResult> {
  const steps = await listLadder(db, employeeId);
  if (steps.length === 0) {
    return { targetPositionId: null, percent: 0, met: 0, total: 0 };
  }
  const met = steps.filter((s) => s.met).length;
  return {
    targetPositionId: steps[0].targetPositionId,
    percent: Math.round((met / steps.length) * 100),
    met,
    total: steps.length,
  };
}
