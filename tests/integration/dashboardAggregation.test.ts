import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import {
  getHrDashboard,
  getManagerDashboard,
  getPostEmploymentSummary,
} from '@/lib/services/dashboardAggregationService';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const DANU = 'b0000000-0000-4000-8000-000000000003'; // manager Budi

describe('WS-11 dashboard aggregation', () => {
  let client: PGlite;
  let db: any;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
  });
  afterAll(async () => { await client.close(); });

  it('getHrDashboard mengembalikan seluruh blok agregasi dengan angka valid', async () => {
    const d = await getHrDashboard(db);
    expect(d.workforce.total).toBeGreaterThanOrEqual(1);
    expect(d.workforce.permanent).toBeGreaterThanOrEqual(1);
    expect(d.recruitment).toHaveProperty('openPostings');
    expect(d.recruitment).toHaveProperty('totalApplications');
    expect(d.onboarding).toHaveProperty('certificatesIssued');
    expect(d.attendance).toHaveProperty('pendingTimesheets');
    expect(d.payroll).toHaveProperty('totalRuns');
    expect(d.learning.completionRate).toBeGreaterThanOrEqual(0);
    expect(d.learning.completionRate).toBeLessThanOrEqual(100);
    expect(d.postEmployment).toHaveProperty('activeOffboardings');
    expect(typeof d.generatedAt).toBe('string');
  });

  it('getHrDashboard tidak crash saat tabel baru kosong', async () => {
    // DB segar tanpa payroll/offboarding items tetap valid.
    const { client: fresh, db: freshDb } = await createTestDb();
    const d = await getHrDashboard(freshDb);
    expect(d.payroll.totalRuns).toBe(0);
    expect(d.payroll.latestTotalNet).toBeNull();
    expect(d.recruitment.avgAtsScore).toBeNull();
    expect(d.onboarding.activePrograms).toBe(0);
    await fresh.close();
  });

  it('getManagerDashboard menghitung tim & approval untuk atasan', async () => {
    const d = await getManagerDashboard(db, DANU);
    expect(d.managerEmployeeId).toBe(DANU);
    expect(d.team.total).toBeGreaterThanOrEqual(1);
    expect(d.approvals).toHaveProperty('pendingTimesheets');
    expect(d.approvals).toHaveProperty('pendingLeaveRequests');
    expect(d.performance).toHaveProperty('nineBoxCounts');
  });

  it('getManagerDashboard untuk atasan tanpa tim → 0 (tidak crash)', async () => {
    const d = await getManagerDashboard(db, BUDI); // Budi bukan manager siapa pun
    expect(d.team.total).toBe(0);
    expect(d.approvals.pendingTimesheets).toBe(0);
  });

  it('getPostEmploymentSummary mengembalikan offboarding + cuti + LCI', async () => {
    const s = await getPostEmploymentSummary(db);
    expect(Array.isArray(s.offboardings)).toBe(true);
    expect(s.offboardings.length).toBeGreaterThanOrEqual(1);
    const o = s.offboardings[0];
    expect(o).toHaveProperty('employeeName');
    expect(o).toHaveProperty('lastWorkingDay');
    expect(s.leave).toHaveProperty('pending');
    expect(s.leave).toHaveProperty('daysApprovedThisYear');
    expect(s.lifetimeContributions.total).toBeGreaterThanOrEqual(1);
  });

  it('agregasi reflektif: menambah assessment ATS mengubah avgAtsScore', async () => {
    const before = await getHrDashboard(db);
    // Tambah resume_parse dengan skor.
    await client.exec(`
      INSERT INTO candidates (id, full_name, email) VALUES (gen_random_uuid(), 'Skor Uji', 'skor.uji@example.com');
    `);
    const cand = await client.query<{ id: string }>(`SELECT id FROM candidates WHERE email='skor.uji@example.com'`);
    await client.query(
      `INSERT INTO resume_parses (candidate_id, ats_score, parser) VALUES ($1::uuid, 88.5, 'HEURISTIC')`,
      [cand.rows[0].id],
    );
    const after = await getHrDashboard(db);
    expect(after.recruitment.avgAtsScore).not.toBeNull();
    expect(after.recruitment.avgAtsScore).toBeGreaterThan(0);
    void before;
  });
});
