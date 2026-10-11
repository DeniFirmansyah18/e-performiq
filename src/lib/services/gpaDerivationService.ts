import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';
import { resolveVisibleEmployeeIds, assertEmployeeVisible } from '@/lib/auth/scope';
import { getSopMetrics } from './sopComplianceService';
import { aggregate360Score } from './coreValuesService';
import { deriveDisciplineIndicator } from './attendanceService';

export interface DerivedComponent {
  value: number | null;
  source: 'derived' | 'missing';
  detail?: Record<string, unknown>;
}

export interface GpaDerivation {
  employeeId: string;
  periodId: string;
  components: {
    sopScore: DerivedComponent;
    coreValuesScore: DerivedComponent;
    discipline: DerivedComponent;
  };
}

/**
 * Pratinjau derivation nilai (keputusan D5): menghitung sopScore & coreValuesScore
 * dari data riil TANPA menulis apa pun. HR/manager menekan "Tarik dari data" lalu Simpan.
 */
export async function previewGpaDerivation(
  db: Db,
  session: SessionPayload,
  employeeId: string,
  periodId: string
): Promise<GpaDerivation> {
  const scope = await resolveVisibleEmployeeIds(db, session);
  assertEmployeeVisible(scope, employeeId);

  const period = (await db.execute(sql`
    SELECT start_date::text AS "startDate", end_date::text AS "endDate"
      FROM appraisal_periods WHERE id = ${periodId}::uuid
  `)) as unknown as { rows: Array<{ startDate: string; endDate: string }> };
  const p = period.rows[0];

  // SOP + faktor disiplin
  let sopComp: DerivedComponent = { value: null, source: 'missing' };
  let disciplineComp: DerivedComponent = { value: null, source: 'missing' };
  const sop = await getSopMetrics(db, employeeId, periodId);
  if (sop) {
    sopComp = {
      value: sop.score,
      source: 'derived',
      detail: { slaRate: sop.slaRate, errorRate: sop.errorRate, baseScore: sop.score },
    };
  }

  if (p) {
    const disc = await deriveDisciplineIndicator(db, employeeId, p.startDate, p.endDate);
    disciplineComp = { value: disc.factor, source: 'derived', detail: { ...disc } };
    if (sop && disciplineComp.value !== null) {
      sopComp = {
        ...sopComp,
        detail: { ...sopComp.detail, finalWithDiscipline: Number((sop.score * disc.factor).toFixed(2)), disciplineFactor: disc.factor },
      };
    }
  }

  // Core values 360
  const agg = await aggregate360Score(db, employeeId, periodId);
  const coreComp: DerivedComponent =
    agg.sufficient && agg.count > 0
      ? { value: agg.score, source: 'derived', detail: { avg: agg.avg, count: agg.count, byGroup: agg.byGroup } }
      : { value: null, source: 'missing', detail: { count: agg.count, sufficient: agg.sufficient } };

  return {
    employeeId,
    periodId,
    components: { sopScore: sopComp, coreValuesScore: coreComp, discipline: disciplineComp },
  };
}
