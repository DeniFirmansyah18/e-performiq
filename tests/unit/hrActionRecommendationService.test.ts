import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import {
  getActionRecommendations,
  getCareerGuidanceForEmployee,
} from '@/lib/services/hrActionRecommendationService';
import { sql } from 'drizzle-orm';

describe('HR Action Recommendation & Career Guidance (TDD)', () => {
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

  it('menghasilkan rekomendasi tindakan HRD berbasis data sistem', async () => {
    const recommendations = await getActionRecommendations(db);
    expect(Array.isArray(recommendations)).toBe(true);
  });

  it('memberikan panduan jenjang karir untuk posisi karyawan', async () => {
    const empRes = await db.execute(sql`SELECT id FROM employees LIMIT 1`);
    const empId = (empRes.rows[0] as { id: string }).id;

    const guidance = await getCareerGuidanceForEmployee(db, empId);
    expect(guidance).toBeDefined();
    expect(guidance.employeeId).toBe(empId);
    expect(Array.isArray(guidance.nextCareerPaths)).toBe(true);
  });
});
