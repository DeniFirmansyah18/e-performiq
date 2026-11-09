import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import * as appraisalService from '@/lib/services/appraisalService';
import { ForbiddenError, ImmutableRecordError } from '@/lib/auth/errors';
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

describe('calibrateAppraisal — otorisasi & scope', () => {
  let client: PGlite;
  let db: Db;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
    // Siapkan appraisal Anisa lewat HR (hasilnya langsung terkunci).
    await appraisalService.calculateAndSaveGPA(db, sess('HR_MANAGER', SITI), {
      periodId: PERIOD_ID,
      employeeId: ANISA,
      kpiScore: 88,
      sopScore: 80,
      competencyScore: 80,
      coreValuesScore: 80,
    });
  });

  afterAll(async () => {
    await client.close();
  });

  it('HR_MANAGER mengunci appraisal yang dihitung PEOPLE_MANAGER (409-safe)', async () => {
    const appr = await appraisalService.getAppraisalByEmployee(db, ANISA, PERIOD_ID);
    if (appr?.isCalibrated) return; // sudah dikunci saat setup — karakterisasi
    const locked = await appraisalService.calibrateAppraisal(
      db,
      sess('HR_MANAGER', SITI),
      appr!.id,
      'Kalibrasi triwulanan'
    );
    expect(locked.isCalibrated).toBe(true);
  });

  it('menolak kalibrasi ulang baris yang sudah terkunci (409)', async () => {
    const appr = await appraisalService.getAppraisalByEmployee(db, ANISA, PERIOD_ID);
    await expect(
      appraisalService.calibrateAppraisal(db, sess('HR_MANAGER', SITI), appr!.id, 'Kalibrasi kedua')
    ).rejects.toBeInstanceOf(ImmutableRecordError);
  });

  it('PEOPLE_MANAGER tanpa izin calibrate ditolak (403)', async () => {
    const appr = await appraisalService.getAppraisalByEmployee(db, ANISA, PERIOD_ID);
    await expect(
      appraisalService.calibrateAppraisal(db, sess('PEOPLE_MANAGER', DANU), appr!.id, 'via manager')
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
