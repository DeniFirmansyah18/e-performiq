import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import * as preEmpService from '@/lib/services/preEmploymentService';
import * as offboardingService from '@/lib/services/offboardingService';
import * as analyticsService from '@/lib/services/analyticsService';
import { BusinessRuleError } from '@/lib/auth/errors';
import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';

const SITI_HR: SessionPayload = {
  userId: 'e0000000-0000-4000-8000-000000000002',
  employeeId: 'b0000000-0000-4000-8000-000000000002',
  role: 'HR_MANAGER',
  email: 'siti.nurhaliza@eperformiq.co.id',
};

const DANU_MGR: SessionPayload = {
  userId: 'e0000000-0000-4000-8000-000000000003',
  employeeId: 'b0000000-0000-4000-8000-000000000003',
  role: 'PEOPLE_MANAGER',
  email: 'danu.tech@eperformiq.co.id',
};

const OFFBOARDING_REQ_ID = '60000000-0000-4000-8000-000000000001';
const UNVERIFIED_HANDOVER_ID = '61000000-0000-4000-8000-000000000003';

describe('Pre-Employment, Offboarding & Analytics Services', () => {
  let client: PGlite;
  let db: Db;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
  });

  afterAll(async () => {
    await client.close();
  });

  it('mengambil rekapitulasi MPP & QoH dari PostgreSQL', async () => {
    const summary = await preEmpService.getMppSummaryData(db, 2026);
    expect(summary.fiscal_year).toBe(2026);
    expect(summary.summary.total_approved_quota).toBeGreaterThan(0);
    expect(summary.quality_of_hire.avg_qoh_score).toBeGreaterThan(0);
    expect(summary.departmental_breakdown.length).toBeGreaterThan(0);
  });

  it('mengambil daftar offboarding beserta status progress serah terima aset', async () => {
    const offboardings = await offboardingService.getOffboardingList(db);
    expect(offboardings.length).toBeGreaterThan(0);
    expect(offboardings[0]).toHaveProperty('handoverProgress');
    expect(offboardings[0].handovers.length).toBe(3);
  });

  it('PRD §8 Hard Gate: menolak kalkulasi pesangon jika checklist serah terima belum 100% (422)', async () => {
    await expect(
      offboardingService.calculateOffboardingSeverance(db, SITI_HR, OFFBOARDING_REQ_ID, 'RESIGNATION', 168000000)
    ).rejects.toThrow(BusinessRuleError);
  });

  it('lolos kalkulasi pesangon PP 35/2021 setelah seluruh serah terima diverifikasi', async () => {
    // Verifikasi item terakhir
    await offboardingService.verifyHandoverItem(db, DANU_MGR, UNVERIFIED_HANDOVER_ID);

    // Sekarang kalkulasi pesangon harus sukses
    const calc = await offboardingService.calculateOffboardingSeverance(
      db, SITI_HR, OFFBOARDING_REQ_ID, 'RESIGNATION', 168000000
    );

    expect(calc).toBeDefined();
    expect(calc.serviceYears).toBe(8);
    expect(Number(calc.totalDisbursement)).toBeGreaterThan(0);
  });

  it('menghitung VMAI Scorecard secara dinamis dari pilar strategis aktif', async () => {
    const vmai = await analyticsService.getVmaiScorecardData(db, '2026-Q3');
    expect(vmai.overallVMAI).toBeGreaterThan(0);
    expect(vmai.perspectives).toHaveProperty('financial');
  });

  it('mengelompokkan demografi karyawan ke dalam 9-Box Talent Placement Grid', async () => {
    const dist = await analyticsService.getNineBoxDistributionData(db, 'd0000000-0000-4000-8000-000000000001');
    expect(dist.total_appraised_employees).toBeGreaterThan(0);
    expect(dist.talent_quadrants.length).toBe(9);
    const futureLeader = dist.talent_quadrants.find((q) => q.quadrant === 'FUTURE_LEADER');
    expect(futureLeader?.count).toBeGreaterThan(0);
  });
});
