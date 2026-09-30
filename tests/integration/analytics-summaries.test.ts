import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { getBenchmarkGap, getExecutiveSummary, getLifecycleSummary } from '@/lib/services/analyticsSummaryService';
import type { Db } from '@/lib/db/client';

describe('analytics summaries reference data', () => {
  let client: PGlite;
  beforeAll(async () => { ({ client } = await createTestDb()); await runSeed(client); });
  afterAll(async () => { await client.close(); });

  it('tabel industry_benchmarks terisi', async () => {
    const r = await client.query<{ c: string }>('SELECT count(*)::text AS c FROM industry_benchmarks');
    expect(Number(r.rows[0].c)).toBeGreaterThan(0);
  });

  it('tabel company_vision_mission terisi minimal 1 baris', async () => {
    const r = await client.query<{ c: string }>('SELECT count(*)::text AS c FROM company_vision_mission');
    expect(Number(r.rows[0].c)).toBeGreaterThanOrEqual(1);
  });

  it('summary services mengembalikan angka finite pada DB ter-seed (tanpa throw)', async () => {
    const db = drizzle(client) as unknown as Db;
    const bench = await getBenchmarkGap(db);
    const exec = await getExecutiveSummary(db);
    const life = await getLifecycleSummary(db);
    expect(Number.isFinite(bench.metrics[1].actual)).toBe(true);
    expect(Number.isFinite(exec.appraisal.average_gpa)).toBe(true);
    expect(Number.isFinite(life.mpp_fulfillment_percentage)).toBe(true);
  });
});

describe('analytics summaries null-safety on empty DB', () => {
  let client: PGlite;
  beforeAll(async () => { ({ client } = await createTestDb()); });
  afterAll(async () => { await client.close(); });

  it('tidak crash pada DB kosong; nilai 0/null-safe', async () => {
    const db = drizzle(client) as unknown as Db;
    const bench = await getBenchmarkGap(db);
    const exec = await getExecutiveSummary(db);
    const life = await getLifecycleSummary(db);
    expect(bench.total_evaluated_employees).toBe(0);
    expect(exec.headcount.total).toBe(0);
    expect(Number.isFinite(exec.appraisal.average_gpa)).toBe(true);
    expect(life.mpp_fulfillment_percentage).toBe(0);
    expect(life.probation_conversion_percentage).toBe(0);
  });
});
