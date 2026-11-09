import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import * as appraisalService from '@/lib/services/appraisalService';
import { can, assertCan } from '@/lib/auth/rbac';
import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const DANU = 'b0000000-0000-4000-8000-000000000003';
const SITI = 'b0000000-0000-4000-8000-000000000002';
const ANISA = 'b0000000-0000-4000-8000-000000000007';
const PERIOD_ID = 'd0000000-0000-4000-8000-000000000001';

const ROLE_USER_IDS: Record<string, string> = {
  EMPLOYEE: 'e0000000-0000-4000-8000-000000000004',
  PEOPLE_MANAGER: 'e0000000-0000-4000-8000-000000000003',
  HR_MANAGER: 'e0000000-0000-4000-8000-000000000002',
};

const sess = (role: string, employeeId: string, email = 'x@x.id'): SessionPayload => ({
  userId: ROLE_USER_IDS[role] ?? 'e0000000-0000-4000-8000-000000000006',
  employeeId,
  role: role as any,
  email,
});

describe('kalibrasi sudah dihapus', () => {
  let client: PGlite;
  let db: Db;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
  });

  afterAll(async () => {
    await client.close();
  });

  it('seed tidak lagi mengunci nilai apa pun', async () => {
    const sebelum = await appraisalService.getAppraisalByEmployee(db, BUDI, PERIOD_ID);
    expect(sebelum!.isCalibrated).toBe(false);
  });

  it('nilai yang dulu terkunci dapat dihitung ulang (tidak ditolak)', async () => {
    const hasil = await appraisalService.calculateAndSaveGPA(db, sess('HR_MANAGER', SITI), {
      periodId: PERIOD_ID,
      employeeId: BUDI,
      kpiScore: 50,
      sopScore: 50,
      competencyScore: 50,
      coreValuesScore: 50,
    });
    expect(Number(hasil.compositeGPA)).toBe(2);
  });

  it('PEOPLE_MANAGER dapat menyimpan hasil kalkulasi tanpa izin khusus', async () => {
    const hasil = await appraisalService.calculateAndSaveGPA(db, sess('PEOPLE_MANAGER', DANU), {
      periodId: PERIOD_ID,
      employeeId: ANISA,
      kpiScore: 80,
      sopScore: 80,
      competencyScore: 80,
      coreValuesScore: 80,
    });
    expect(Number(hasil.compositeGPA)).toBeGreaterThan(0);
  });

  it('permission appraisal:calibrate sudah tidak ada', () => {
    expect('appraisal:calibrate' in (can as any)).toBeDefined();
    expect(() => assertCan(sess('HR_MANAGER', SITI), 'appraisal:calibrate' as any)).toThrow();
  });
});
