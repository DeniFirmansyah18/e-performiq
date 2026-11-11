import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { selectActivePillars } from '@/lib/repositories/analyticsRepository';
import type { Db } from '@/lib/db/client';

describe('VMAI pillar scoring from real KPIs', () => {
  let client: PGlite; let db: Db;
  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  });
  afterAll(async () => { await client.close(); });

  it('menghitung achievedScore dari individual_kpis, bukan konstanta 92.4', async () => {
    const pillars = await selectActivePillars(db);
    const internal = pillars.find((p) => p.perspective === 'INTERNAL_PROCESS')!;

    // Inti tes: nilai dihitung dari KPI nyata dan bergerak bila data berubah.
    // achievedScore memakai pembobotan, jadi tidak sama persis dengan rata-rata
    // sederhana; yang diuji adalah ia berasal dari rentang data KPI pilar itu
    // dan bukan angka tetap.
    const res = await client.query<{ min: string; max: string }>(
      `SELECT min(ik.achievement_percentage)::text AS min, max(ik.achievement_percentage)::text AS max
         FROM strategic_pillars sp
         JOIN individual_kpis ik ON ik.strategic_pillar_id = sp.id
        WHERE sp.perspective = 'INTERNAL_PROCESS'`
    );
    const min = Number(res.rows[0].min);
    const max = Number(res.rows[0].max);
    expect(internal.achievedScore).toBeGreaterThanOrEqual(min);
    expect(internal.achievedScore).toBeLessThanOrEqual(max);
    expect(Number.isFinite(internal.achievedScore)).toBe(true);
    expect(internal.achievedScore).not.toBe(92.4);
  });

  it('mengembalikan nilai finite (bukan NaN) bila tidak ada KPI', async () => {
    const pillars = await selectActivePillars(db, '9999-NONE');
    for (const p of pillars) expect(Number.isFinite(p.achievedScore)).toBe(true);
  });
});
