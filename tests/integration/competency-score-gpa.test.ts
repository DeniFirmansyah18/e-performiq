import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { deriveCompetencyScoreForEmployee } from '@/lib/services/competencyScoreService';
import { calculateCompositeGPA } from '@/lib/engines/gpa-engine';
import type { Db } from '@/lib/db/client';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const PERIOD = 'd0000000-0000-4000-8000-000000000001';

describe('DUR-03 competency score from LMS (backward-compatible)', () => {
  let client: PGlite; let db: Db;
  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  });
  afterAll(async () => { await client.close(); });

  it('menghitung skor kompetensi finite (0-100) dari data LMS (tanpa evidence -> default)', async () => {
    const score = await deriveCompetencyScoreForEmployee(db, BUDI, PERIOD);
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    // Tanpa evidence, skor = base 70 (lihat engine).
    expect(score).toBe(70);
  });

  it('GPA lama tetap identik bila memakai competencyScore asli (regresi PRD 11.3 = 3.67)', () => {
    const result = calculateCompositeGPA({ kpiScore: 92.5, sopScore: 96, competencyScore: 85, coreValuesScore: 90, potentialScore: 4.2 });
    expect(result.compositeGPA).toBe(3.67);
  });

  it('GPA valid (0-4) saat memakai skor turunan', async () => {
    const score = await deriveCompetencyScoreForEmployee(db, BUDI, PERIOD);
    const result = calculateCompositeGPA({ kpiScore: 92.5, sopScore: 96, competencyScore: score, coreValuesScore: 90 });
    expect(result.compositeGPA).toBeGreaterThanOrEqual(0);
    expect(result.compositeGPA).toBeLessThanOrEqual(4);
  });
});
