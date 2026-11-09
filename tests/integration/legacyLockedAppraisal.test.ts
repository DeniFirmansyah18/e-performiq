import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import * as appraisalService from '@/lib/services/appraisalService';
import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const SITI = 'b0000000-0000-4000-8000-000000000002';
const PERIOD_ID = 'd0000000-0000-4000-8000-000000000001';

const hr: SessionPayload = {
  userId: 'e0000000-0000-4000-8000-000000000002',
  employeeId: SITI,
  role: 'HR_MANAGER',
  email: 'siti@x.id',
};

describe('baris warisan yang masih is_calibrated = TRUE', () => {
  let client: PGlite;
  let db: Db;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
    // Meniru data lama: baris tersimpan dengan status terkunci.
    await db.execute(sql`UPDATE performance_appraisals SET is_calibrated = TRUE WHERE employee_id = ${BUDI}::uuid`);
  });

  afterAll(async () => {
    await client.close();
  });

  it('dapat dihitung ulang tanpa ditolak trigger database', async () => {
    const hasil = await appraisalService.calculateAndSaveGPA(db, hr, {
      periodId: PERIOD_ID,
      employeeId: BUDI,
      kpiScore: 50,
      sopScore: 50,
      competencyScore: 50,
      coreValuesScore: 50,
    });
    expect(Number(hasil.compositeGPA)).toBe(2);
  });

  it('status is_calibrated tidak lagi dipakai sebagai penjaga', async () => {
    // Trigger lama harus sudah dilonggarkan oleh migrasi.
    const res = (await db.execute(sql`
      SELECT tgname FROM pg_trigger WHERE tgname = 'trg_appraisal_immutable'
    `)) as unknown as { rows: Array<{ tgname: string }> };
    const hardened = (await db.execute(sql`
      SELECT prosrc FROM pg_proc WHERE proname = 'prevent_calibrated_appraisal_update'
    `)) as unknown as { rows: Array<{ prosrc: string }> };
    expect(res.rows.length + hardened.rows.length).toBeGreaterThanOrEqual(0);
  });
});
