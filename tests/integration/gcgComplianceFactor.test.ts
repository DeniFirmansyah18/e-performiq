import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { computeGcgComplianceFactor, getVmaiScorecardData } from '@/lib/services/analyticsService';
import { getBenchmarkGap } from '@/lib/services/analyticsSummaryService';

describe('Stage 7 — faktor kepatuhan GCG nyata + VMAI_TARGET aktual', () => {
  let client: PGlite;
  let db: Db;
  const PERIOD = 'd0000000-0000-4000-8000-000000000001'; // 2026-Q3 (ACTIVE)
  const EMP = 'b0000000-0000-4000-8000-000000000004';

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
    await client.exec(`DELETE FROM sop_compliance_logs WHERE period_id='${PERIOD}'`);
  });
  afterAll(async () => { await client.close(); });

  it('tanpa temuan audit → faktor = 1.00', async () => {
    expect(await computeGcgComplianceFactor(db, '2026-Q3')).toBe(1);
  });

  it('temuan fatal menurunkan faktor (0.1/temuan, maksimum 0.5)', async () => {
    await client.exec(`
      INSERT INTO sop_compliance_logs (period_id, employee_id, total_assigned_tasks, procedure_errors, compliance_percentage)
      VALUES ('${PERIOD}'::uuid, '${EMP}'::uuid, 10, 3, 85);
    `);
    expect(await computeGcgComplianceFactor(db, '2026-Q3')).toBe(0.7); // 1 - 0.3

    await client.exec(`UPDATE sop_compliance_logs SET procedure_errors = 20 WHERE period_id='${PERIOD}'`);
    expect(await computeGcgComplianceFactor(db, '2026-Q3')).toBe(0.5); // capped
  });

  it('VMAI scorecard memakai faktor GCG nyata', async () => {
    await client.exec(`UPDATE sop_compliance_logs SET procedure_errors = 2 WHERE period_id='${PERIOD}'`);
    const sc = await getVmaiScorecardData(db, '2026-Q3');
    expect(sc.gcgComplianceFactor).toBe(0.8); // 1 - 0.2
  });

  it('benchmark-gap VMAI_TARGET.actual = nilai VMAI scorecard', async () => {
    const gap = await getBenchmarkGap(db, '2026-Q3');
    const vmaiMetric = gap.metrics.find((m) => m.code === 'VMAI_TARGET')!;
    const sc = await getVmaiScorecardData(db, '2026-Q3');
    expect(vmaiMetric.actual).toBe(Number(sc.overallVMAI.toFixed(2)));
    expect(vmaiMetric.variance).toBe(Number((vmaiMetric.actual - vmaiMetric.benchmark).toFixed(2)));
  });
});
