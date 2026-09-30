import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { getCompetencyProfile, upsertCompetencyEvidence } from '@/lib/services/competencyService';
import { createPlan, addPlanItem, advancePlanItem } from '@/lib/services/learningPlanService';
import type { Db } from '@/lib/db/client';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const PERIOD = 'd0000000-0000-4000-8000-000000000001';

describe('competency + learning plan services', () => {
  let client: PGlite; let db: Db;
  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  });
  afterAll(async () => { await client.close(); });

  it('getCompetencyProfile mengembalikan kompetensi dengan level/gap finite', async () => {
    const profile = await getCompetencyProfile(db, BUDI);
    expect(Array.isArray(profile.competencies)).toBe(true);
    for (const c of profile.competencies) {
      expect(Number.isFinite(c.level)).toBe(true);
      expect(Number.isFinite(c.gap)).toBe(true);
    }
  });

  it('getCompetencyProfile null-safe untuk karyawan tanpa evidence', async () => {
    const profile = await getCompetencyProfile(db, 'b0000000-0000-4000-8000-000000000007');
    expect(Array.isArray(profile.competencies)).toBe(true);
  });

  it('upsertCompetencyEvidence menyimpan evidence', async () => {
    const comp = (await client.query<{ id: string }>(`SELECT id FROM competencies LIMIT 1`)).rows[0].id;
    await upsertCompetencyEvidence(db, { employeeId: BUDI, competencyId: comp, source: 'MANUAL', rating: 4 });
    const r = await client.query<{ c: string }>(`SELECT count(*)::text AS c FROM competency_evidence WHERE employee_id=$1::uuid AND source='MANUAL'`, [BUDI]);
    expect(Number(r.rows[0].c)).toBeGreaterThanOrEqual(1);
  });

  it('createPlan + addPlanItem + advancePlanItem mempersist status', async () => {
    const plan = await createPlan(db, { employeeId: BUDI, title: 'IDP Test', periodId: PERIOD });
    const item = await addPlanItem(db, { planId: plan.id, targetLevel: 5 });
    const updated = await advancePlanItem(db, item.id, 'DONE');
    expect(updated.status).toBe('DONE');
  });
});
