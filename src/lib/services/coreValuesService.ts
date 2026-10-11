import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';
import { resolveVisibleEmployeeIds, assertEmployeeVisible } from '@/lib/auth/scope';
import { aggregateReviews, MIN_REVIEWERS } from '@/lib/engines/360-aggregation-engine';
import type { Review360Row } from '@/lib/engines/360-aggregation-engine';

interface Raw360Row extends Review360Row {
  createdAt: string;
}

/**
 * Daftar review 360° untuk seorang karyawan. ANONIM: identitas evaluator
 * TIDAK pernah dikembalikan (GCG §6.2) — hanya hubungan + skor agregat per baris.
 */
export async function list360Reviews(
  db: Db,
  employeeId: string,
  periodId: string
): Promise<Raw360Row[]> {
  const res = (await db.execute(sql`
    SELECT relationship_type AS "relationshipType",
           integrity_score AS "integrityScore",
           collaboration_score AS "collaborationScore",
           innovation_score AS "innovationScore",
           created_at::text AS "createdAt"
      FROM peer_reviews_360
     WHERE evaluatee_id = ${employeeId}::uuid AND period_id = ${periodId}::uuid
     ORDER BY created_at ASC
  `)) as unknown as { rows: Array<Record<string, unknown>> };

  return (res.rows ?? []).map((r) => ({
    relationshipType: r.relationshipType as Review360Row['relationshipType'],
    integrityScore: Number(r.integrityScore),
    collaborationScore: Number(r.collaborationScore),
    innovationScore: Number(r.innovationScore),
    createdAt: String(r.createdAt),
  }));
}

/** Agregat + status kecukupan reviewer. Dipakai untuk derivation coreValuesScore. */
export async function aggregate360Score(db: Db, employeeId: string, periodId: string) {
  const rows = await list360Reviews(db, employeeId, periodId);
  const agg = aggregateReviews(rows);
  return { ...agg, minimumReviewers: MIN_REVIEWERS };
}

/** Validasi scope sebelum mengembalikan agregat lintas-karyawan. */
export async function get360ForSession(
  db: Db,
  session: SessionPayload,
  employeeId: string,
  periodId: string
) {
  const scope = await resolveVisibleEmployeeIds(db, session);
  assertEmployeeVisible(scope, employeeId);
  const agg = await aggregate360Score(db, employeeId, periodId);
  return agg;
}
