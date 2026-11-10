import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { evaluateProbationMilestone } from '@/lib/services/preEmploymentService';

const SITI_USER = 'e0000000-0000-4000-8000-000000000002';
const SITI_EMP = 'b0000000-0000-4000-8000-000000000002';
const HENDRA_USER = 'e0000000-0000-4000-8000-000000000001';

let client: PGlite;
let db: Db;

beforeAll(async () => {
  ({ client } = await createTestDb());
  await runSeed(client);
  db = drizzle(client) as unknown as Db;
}, 60000);

afterAll(async () => { await client.close(); });

/**
 * Menilai diri sendiri adalah konflik kepentingan. Evaluasi probation hanya
 * boleh dilakukan ATASAN (atau HR/Super Admin untuk pegawai lain) — bukan
 * oleh pemilik milestone itu sendiri.
 */
describe('evaluasi probation tidak boleh menilai diri sendiri', () => {
  it('HR tidak boleh mengevaluasi probation miliknya sendiri', async () => {
    const rows = await client.query<{ id: string }>(
      `SELECT id FROM onboarding_milestones WHERE employee_id = $1 LIMIT 1`,
      [SITI_EMP]
    );
    // Buat milestone bila seed belum punya, agar uji tidak bergantung pada data.
    let onboardingId = rows.rows[0]?.id;
    if (!onboardingId) {
      const ins = await client.query<{ id: string }>(
        `INSERT INTO onboarding_milestones (id, employee_id, day_30_score, day_60_score, day_90_score)
         VALUES (gen_random_uuid(), $1, 0, 0, 0) RETURNING id`,
        [SITI_EMP]
      );
      onboardingId = ins.rows[0].id;
    }

    const sesi = { userId: SITI_USER, employeeId: SITI_EMP, role: 'HR_MANAGER', email: 's@x.id' } as any;
    await expect(
      evaluateProbationMilestone(db, sesi, onboardingId, { day30Score: 90 })
    ).rejects.toThrow(/sendiri/i);
  });

  it('atasan (CEO) tetap boleh mengevaluasi probation bawahannya', async () => {
    const r = await client.query<{ id: string }>(
      `SELECT id FROM onboarding_milestones WHERE employee_id = $1 LIMIT 1`,
      [SITI_EMP]
    );
    let onboardingId = r.rows[0]?.id;
    if (!onboardingId) {
      const ins = await client.query<{ id: string }>(
        `INSERT INTO onboarding_milestones (id, employee_id, day_30_score, day_60_score, day_90_score)
         VALUES (gen_random_uuid(), $1, 0, 0, 0) RETURNING id`,
        [SITI_EMP]
      );
      onboardingId = ins.rows[0].id;
    }

    const sesi = { userId: HENDRA_USER, employeeId: 'b0000000-0000-4000-8000-000000000001', role: 'BOD', email: 'h@x.id' } as any;
    const hasil = await evaluateProbationMilestone(db, sesi, onboardingId, { day30Score: 88 });
    expect(hasil).toBeTruthy();
  });
});
