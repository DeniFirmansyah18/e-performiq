import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { getEmployeeBscContribution } from '@/lib/services/employeeBscContributionService';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const CEO = 'b0000000-0000-4000-8000-000000000001';

describe('Kontribusi BSC per karyawan (Narasi 3 pilar 7)', () => {
  let client: PGlite;
  let db: Db;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  }, 60000);

  afterAll(async () => {
    await client.close();
  });

  it('memetakan KPI karyawan ke pilar strategis beserta bobotnya', async () => {
    const result = await getEmployeeBscContribution(db, BUDI);
    expect(result.fullName).toBe('Budi Pratama');
    expect(result.hasKpi).toBe(true);
    expect(result.pillars.length).toBeGreaterThan(0);
    // Bobot pilar dibaca dari strategic_pillars, bukan hardcoded.
    expect(result.pillars[0].strategicWeight).toBeGreaterThan(0);
    expect(result.pillars[0].kpiCount).toBeGreaterThan(0);
  });

  it('menyertakan performa terakhir (GPA, rating, kuadran 9-box)', async () => {
    const result = await getEmployeeBscContribution(db, BUDI);
    expect(result.latestGpa).toBe(3.67);
    expect(result.latestRating).toBe('A');
    expect(result.nineBoxQuadrant).toBe('FUTURE_LEADER');
  });

  it('karyawan tanpa KPI dilaporkan hasKpi=false, bukan 0% performa', async () => {
    const result = await getEmployeeBscContribution(db, CEO);
    expect(result.hasKpi).toBe(false);
    expect(result.pillars).toEqual([]);
    expect(result.latestGpa).toBeNull();
  });

  it('melempar error untuk karyawan yang tidak ada', async () => {
    await expect(
      getEmployeeBscContribution(db, '00000000-0000-4000-8000-000000000000')
    ).rejects.toThrow('Karyawan tidak ditemukan.');
  });
});