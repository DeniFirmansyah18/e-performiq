import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';
import {
  createOffboardingRequest,
  verifyHandoverItem,
  calculateOffboardingSeverance,
  disburseSeverance,
} from '@/lib/services/offboardingService';
import { generateFinalSettlementRun } from '@/lib/services/payrollService';
import { selectHandoversByRequest } from '@/lib/repositories/offboardingRepository';

const HR_SESSION: SessionPayload = {
  userId: 'e0000000-0000-4000-8000-000000000002',
  employeeId: 'b0000000-0000-4000-8000-000000000002',
  role: 'HR_MANAGER',
  email: 'siti.nurhaliza@eperformiq.co.id',
};

// Karyawan seed (Budi Pratama) yang punya akun login & bebas offboarding seed.
const EMP = 'b0000000-0000-4000-8000-000000000004';

describe('Offboarding lifecycle: state machine + write-back karyawan', () => {
  let client: PGlite;
  let db: Db;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
    // Bersihkan state offboarding karyawan uji.
    await client.exec(`
      DELETE FROM severance_calculations WHERE offboarding_request_id IN (SELECT id FROM offboarding_requests WHERE employee_id='${EMP}');
      DELETE FROM knowledge_handovers WHERE offboarding_request_id IN (SELECT id FROM offboarding_requests WHERE employee_id='${EMP}');
      DELETE FROM offboarding_requests WHERE employee_id='${EMP}';
      UPDATE employees SET status='PERMANENT', last_working_day=NULL WHERE id='${EMP}';
      UPDATE users SET is_active=TRUE WHERE employee_id='${EMP}';
    `);
  });
  afterAll(async () => { await client.close(); });

  async function reqStatus(): Promise<string> {
    const r = await client.query<{ status: string }>(
      `SELECT status FROM offboarding_requests WHERE employee_id='${EMP}' ORDER BY created_at DESC LIMIT 1`);
    return r.rows[0]?.status;
  }

  it('request baru mulai dari INITIATED dengan 3 checklist clearance', async () => {
    const created = await createOffboardingRequest(db, HR_SESSION, {
      employeeId: EMP,
      reasonForLeaving: 'Resign',
      resignationNoticeDate: '2026-11-01',
      lastWorkingDay: '2026-12-01',
    });
    expect(await reqStatus()).toBe('INITIATED');
    const handovers = await selectHandoversByRequest(db, created.id);
    expect(handovers.length).toBe(3);
    expect(handovers.every((h) => !h.isVerified)).toBe(true);
  });

  it('verifikasi handover pertama memajukan status ke CLEARANCE_IN_PROGRESS', async () => {
    const created = await client.query<{ id: string }>(
      `SELECT id FROM offboarding_requests WHERE employee_id='${EMP}' ORDER BY created_at DESC LIMIT 1`);
    const handovers = await selectHandoversByRequest(db, created.rows[0].id);
    await verifyHandoverItem(db, HR_SESSION, handovers[0].id);
    expect(await reqStatus()).toBe('CLEARANCE_IN_PROGRESS');
  });

  it('kalkulasi pesangon DITOLAK bila clearance belum 100% (PRD §8)', async () => {
    const created = await client.query<{ id: string }>(
      `SELECT id FROM offboarding_requests WHERE employee_id='${EMP}' ORDER BY created_at DESC LIMIT 1`);
    await expect(
      calculateOffboardingSeverance(db, HR_SESSION, created.rows[0].id, 'RESIGNATION')
    ).rejects.toThrow(/belum terverifikasi/i);
  });

  it('setelah clearance 100% + pesangon cair → offboarding COMPLETED & karyawan dinonaktifkan', async () => {
    const created = await client.query<{ id: string }>(
      `SELECT id FROM offboarding_requests WHERE employee_id='${EMP}' ORDER BY created_at DESC LIMIT 1`);
    const reqId = created.rows[0].id;

    // Verifikasi sisa handover.
    const handovers = await selectHandoversByRequest(db, reqId);
    for (const h of handovers.filter((x) => !x.isVerified)) {
      await verifyHandoverItem(db, HR_SESSION, h.id);
    }

    const severance = await calculateOffboardingSeverance(db, HR_SESSION, reqId, 'EFFICIENCY');
    expect(Number(severance.totalDisbursement)).toBeGreaterThan(0);

    const paid = await disburseSeverance(db, HR_SESSION, severance.id);
    expect(paid.completion.offboardingStatus).toBe('COMPLETED');
    expect(paid.completion.employeeDeactivated).toBe(true);
    expect(paid.completion.exitStatus).toBe('RESIGNED');

    expect(await reqStatus()).toBe('COMPLETED');

    const emp = await client.query<{ status: string; last_working_day: string }>(
      `SELECT status, last_working_day::text AS last_working_day FROM employees WHERE id='${EMP}'`);
    expect(emp.rows[0].status).toBe('RESIGNED');
    expect(emp.rows[0].last_working_day).toBe('2026-12-01');

    const usr = await client.query<{ is_active: boolean }>(
      `SELECT is_active FROM users WHERE employee_id='${EMP}'`);
    expect(usr.rows[0]?.is_active).toBe(false);
  });

  it('idempoten: mencairkan ulang tidak mengubah status/akun lagi', async () => {
    const created = await client.query<{ id: string }>(
      `SELECT id FROM offboarding_requests WHERE employee_id='${EMP}' ORDER BY created_at DESC LIMIT 1`);
    const sc = await client.query<{ id: string }>(
      `SELECT id FROM severance_calculations WHERE offboarding_request_id='${created.rows[0].id}'`);
    const paidAgain = await disburseSeverance(db, HR_SESSION, sc.rows[0].id);
    expect(paidAgain.completion.employeeDeactivated).toBe(false); // sudah RESIGNED → tidak berubah
    expect(await reqStatus()).toBe('COMPLETED');
  });

  it('status state machine bersifat monotonik (COMPLETED tidak mundur ke CLEARANCE_IN_PROGRESS)', async () => {
    const created = await client.query<{ id: string }>(
      `SELECT id FROM offboarding_requests WHERE employee_id='${EMP}' ORDER BY created_at DESC LIMIT 1`);
    const handovers = await selectHandoversByRequest(db, created.rows[0].id);
    await verifyHandoverItem(db, HR_SESSION, handovers[0].id);
    expect(await reqStatus()).toBe('COMPLETED');
  });

  it('gate clearance (sumber tunggal): run FINAL_SETTLEMENT DITOLAK bila checklist belum 100%', async () => {
    // Request offboarding BARU dengan clearance masih kosong → FS harus ditolak.
    const fresh = await createOffboardingRequest(db, HR_SESSION, {
      employeeId: 'b0000000-0000-4000-8000-000000000009',
      reasonForLeaving: 'Resign',
      resignationNoticeDate: '2026-11-01',
      lastWorkingDay: '2026-12-01',
    });
    await expect(
      generateFinalSettlementRun(db, { offboardingRequestId: fresh.id, periodCode: '2026-12' })
    ).rejects.toThrow(/belum terverifikasi/i);
  });
});
