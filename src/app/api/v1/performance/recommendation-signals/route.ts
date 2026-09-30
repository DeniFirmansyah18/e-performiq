import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { resolveVisibleEmployeeIds, assertEmployeeVisible } from '@/lib/auth/scope';
import { ok, problem } from '@/lib/api/response';
import { generateTalentRecommendationSignal } from '@/lib/services/productivityService';
import type { NineBoxQuadrant } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/performance/recommendation-signals?employee_id=<uuid, opsional>
// Kotak 1 Govera360 — sinyal rekomendasi talenta (PIP / MUTATION / PROMOTION)
// dari rapor terakhir setiap karyawan dalam cakupan sesi.
export async function GET(req: NextRequest) {
try {
const session = await getAuthSession(req);
assertCan(session, 'kpi:read');



const scope = await resolveVisibleEmployeeIds(db, session);
const { searchParams } = new URL(req.url);
const requested = searchParams.get('employee_id');
if (requested) assertEmployeeVisible(scope, requested);

let targets: string[];
if (requested) {
  targets = [requested];
} else if (scope === 'ALL') {
  const all = await db.execute(sql`
    SELECT id::text AS "id" FROM employees
     WHERE status IN ('PROBATION','PERMANENT','CONTRACT')
  `);
  targets = (all.rows as Array<{ id: string }>).map((r) => r.id);
} else {
  targets = scope;
}

if (targets.length === 0) {
  return ok({ items: [], total: 0 }, 'Tidak ada karyawan dalam cakupan Anda.');
}

const ids = sql.join(
  targets.map((t) => sql`${t}::uuid`),
  sql`, `
);

const result = await db.execute(sql`
  SELECT DISTINCT ON (pa.employee_id)
         pa.employee_id::text AS "employeeId",
         e.full_name AS "fullName",
         pa.composite_gpa AS "gpa",
         pa.nine_box_quadrant AS "nineBox"
    FROM performance_appraisals pa
    JOIN employees e ON e.id = pa.employee_id
   WHERE pa.employee_id IN (${ids})
   ORDER BY pa.employee_id, pa.created_at DESC
`);

const items = (result.rows as Array<{ employeeId: string; fullName: string; gpa: string; nineBox: string }>).map(
  (row) => ({
    employeeId: row.employeeId,
    fullName: row.fullName,
    gpa: Number(row.gpa),
    nineBox: row.nineBox,
    signal: generateTalentRecommendationSignal({
      gpa: Number(row.gpa),
      nineBox: row.nineBox as NineBoxQuadrant,
    }),
  })
);

return ok({ items, total: items.length }, 'Sinyal rekomendasi talenta berhasil dimuat.');
} catch (err) {
return problem(err, 'recommendation-signals');
}
}
