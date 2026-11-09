import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import * as appraisalService from '@/lib/services/appraisalService';
import { ForbiddenError } from '@/lib/auth/errors';
import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';

const DANU = 'b0000000-0000-4000-8000-000000000003';
const SITI = 'b0000000-0000-4000-8000-000000000002';
const ANISA = 'b0000000-0000-4000-8000-000000000007';
const PERIOD_ID = 'd0000000-0000-4000-8000-000000000001';

const ROLE_USER_IDS: Record<string, string> = {
  EMPLOYEE: 'e0000000-0000-4000-8000-000000000004',
  PEOPLE_MANAGER: 'e0000000-0000-4000-8000-000000000003',
  HR_MANAGER: 'e0000000-0000-4000-8000-000000000002',
  AUDITOR: 'e0000000-0000-4000-8000-000000000005',
};

const sess = (role: string, employeeId: string, email = 'x@x.id'): SessionPayload => ({
  userId: ROLE_USER_IDS[role] ?? 'e0000000-0000-4000-8000-000000000006',
  employeeId,
  role: role as any,
  email,
});

describe('calculateAndSaveGPA — peran tanpa izin kalibrasi', () => {
  let client: PGlite;
  let db: Db;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
  });

  afterAll(async () => {
    await client.close();
  });

  it('PEOPLE_MANAGER tidak dapat menyimpan hasil kalkulasi (403)', async () => {
    await expect(
      appraisalService.calculateAndSaveGPA(db, sess('PEOPLE_MANAGER', DANU), {
        periodId: PERIOD_ID,
        employeeId: ANISA,
        kpiScore: 88,
        sopScore: 92,
        competencyScore: 85,
        coreValuesScore: 90,
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('percobaan PEOPLE_MANAGER tidak mengubah nilai maupun status kunci', async () => {
    const before = await appraisalService.getAppraisalByEmployee(db, ANISA, PERIOD_ID);
    const gpa = before?.compositeGPA ?? null;
    const locked = before?.isCalibrated ?? null;

    await appraisalService
      .calculateAndSaveGPA(db, sess('PEOPLE_MANAGER', DANU), {
        periodId: PERIOD_ID,
        employeeId: ANISA,
        kpiScore: 10,
        sopScore: 10,
        competencyScore: 10,
        coreValuesScore: 10,
      })
      .catch(() => undefined);

    const after = await appraisalService.getAppraisalByEmployee(db, ANISA, PERIOD_ID);
    expect(after?.compositeGPA ?? null).toBe(gpa);
    expect(after?.isCalibrated ?? null).toBe(locked);
  });

  it('HR_MANAGER tetap dapat menghitung dan hasilnya terkunci', async () => {
    const saved = await appraisalService.calculateAndSaveGPA(db, sess('HR_MANAGER', SITI), {
      periodId: PERIOD_ID,
      employeeId: ANISA,
      kpiScore: 88,
      sopScore: 80,
      competencyScore: 80,
      coreValuesScore: 80,
    });
    expect(saved.isCalibrated).toBe(true);
  });
});
