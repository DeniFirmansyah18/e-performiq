import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { resolveVisibleEmployeeIds, assertEmployeeVisible } from '@/lib/auth/scope';
import { ok, problem } from '@/lib/api/response';
import { buildRiskProfile, calculateFlightRisk } from '@/lib/services/coreHrService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/governance/flight-risk?employee_id=<uuid, opsional>
// Kotak 4 Govera360 — daftar skor flight risk per karyawan dalam cakupan sesi.
// Dikunci ke role berhak via 'flight_risk:read' (GCG segregation of duty).
export async function GET(req: NextRequest) {
try {
const session = await getAuthSession(req);
assertCan(session, 'flight_risk:read');



const scope = await resolveVisibleEmployeeIds(db, session);
const { searchParams } = new URL(req.url);
const requested = searchParams.get('employee_id');
if (requested) assertEmployeeVisible(scope, requested);

let rows: Array<{ id: string; fullName: string }>;
if (requested) {
  const r = await db.execute(sql`
    SELECT id::text AS "id", full_name AS "fullName"
      FROM employees WHERE id = ${requested}::uuid
  `);
  rows = r.rows as Array<{ id: string; fullName: string }>;
} else if (scope === 'ALL') {
  const r = await db.execute(sql`
    SELECT id::text AS "id", full_name AS "fullName"
      FROM employees
     WHERE status IN ('PROBATION','PERMANENT','CONTRACT')
     ORDER BY full_name
  `);
  rows = r.rows as Array<{ id: string; fullName: string }>;
} else {
  if (scope.length === 0) {
    return ok({ items: [], total: 0 }, 'Tidak ada karyawan dalam cakupan Anda.');
  }
  const ids = sql.join(
    scope.map((id) => sql`${id}::uuid`),
    sql`, `
  );
  const r = await db.execute(sql`
    SELECT id::text AS "id", full_name AS "fullName"
      FROM employees WHERE id IN (${ids}) ORDER BY full_name
  `);
  rows = r.rows as Array<{ id: string; fullName: string }>;
}

const items = [];
for (const row of rows) {
  const profile = await buildRiskProfile(db, row.id);
  const risk = calculateFlightRisk(profile);
  items.push({
    employeeId: row.id,
    fullName: row.fullName,
    bradfordFactor: profile.bradfordFactor,
    peerReviewAvg: profile.peerReviewAvg,
    overtimeHoursWeekly: profile.overtimeHoursWeekly,
    score: risk.score,
    level: risk.level,
    warnings: risk.warnings,
  });
}

return ok({ items, total: items.length }, 'Data flight risk berhasil dimuat.');
} catch (err) {
return problem(err, 'flight-risk');
}
}
