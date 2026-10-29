import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';
import { convertHiredCandidate } from '@/lib/services/candidateConversionService';
import { extendOffer } from '@/lib/services/offerService';
import { evaluateProbationMilestone } from '@/lib/services/preEmploymentService';
import {
  createOffboardingRequest,
  verifyHandoverItem,
  calculateOffboardingSeverance,
  disburseSeverance,
} from '@/lib/services/offboardingService';
import { selectHandoversByRequest } from '@/lib/repositories/offboardingRepository';
import { hashPassword } from '@/lib/auth/password';

const HR_SESSION: SessionPayload = {
  userId: 'e0000000-0000-4000-8000-000000000002',
  employeeId: 'b0000000-0000-4000-8000-000000000002',
  role: 'HR_MANAGER',
  email: 'siti.nurhaliza@eperformiq.co.id',
};

describe('Stage 6 — notifikasi siklus hidup karyawan (best-effort)', () => {
  let client: PGlite;
  let db: Db;
  let postingId: string;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
    const q = await client.query<{ id: string }>(`SELECT id FROM job_postings LIMIT 1`);
    postingId = q.rows[0].id;
  });
  afterAll(async () => { await client.close(); });

  async function notifCount(employeeId: string, eventType: string): Promise<number> {
    const r = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM employee_notifications WHERE employee_id=$1::uuid AND event_type=$2`,
      [employeeId, eventType]);
    return Number(r.rows[0].n);
  }

  async function makeCandidate(email: string): Promise<string> {
    const hash = await hashPassword('rahasia123');
    const acc = await client.query<{ id: string }>(
      `INSERT INTO candidate_accounts (email, password_hash, full_name, is_verified)
       VALUES ($1, $2, 'Kandidat Notif', TRUE) RETURNING id`, [email, hash]);
    const cand = await client.query<{ id: string }>(
      `INSERT INTO candidates (full_name, email, account_id) VALUES ('Kandidat Notif', $1, $2) RETURNING id`,
      [email, acc.rows[0].id]);
    const app = await client.query<{ id: string }>(
      `INSERT INTO job_applications (application_no, candidate_id, job_posting_id, status)
       VALUES ($1, $2, $3, 'INTERVIEW'::application_status_enum) RETURNING id`,
      [`APP-NOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, cand.rows[0].id, postingId]);
        // ADR 023: konversi HIRED membutuhkan penawaran dengan gaji tercatat.
        await extendOffer(db, {
          applicationId: app.rows[0].id,
          offeredByUserId: null,
          baseSalary: 28500000,
          responseDays: 7,
        });
        return app.rows[0].id;
      }

  it('konversi HIRED → notifikasi HIRED_ONBOARDING', async () => {
    const email = `notif.hired.${Date.now()}@example.com`;
    const applicationId = await makeCandidate(email);
    const res = await convertHiredCandidate(db, { applicationId });
    expect(await notifCount(res.employeeId, 'HIRED_ONBOARDING')).toBe(1);

    // Email ikut diantre ke outbox karyawan.
    const out = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM email_outbox WHERE recipient=$1`, [email.toLowerCase()]);
    expect(Number(out.rows[0].n)).toBeGreaterThan(0);
  });

  it('evaluasi probation lulus → notifikasi PROBATION_PASSED', async () => {
    const emp = 'b0000000-0000-4000-8000-000000000009'; // Rian Hidayat (PROBATION)
    await client.exec(`
      INSERT INTO onboarding_milestones (employee_id, probation_passed)
      VALUES ('${emp}'::uuid, FALSE) ON CONFLICT (employee_id) DO NOTHING;
      UPDATE employees SET status='PROBATION'::employee_status_enum WHERE id='${emp}'::uuid;
    `);
    const ms = await client.query<{ id: string }>(
      `SELECT id FROM onboarding_milestones WHERE employee_id='${emp}'::uuid`);
    await evaluateProbationMilestone(db, HR_SESSION, ms.rows[0].id, {
      day30Score: 85, day60Score: 88, day90Score: 90, managerNotes: 'Sangat baik', probationPassed: true,
    });
    expect(await notifCount(emp, 'PROBATION_PASSED')).toBe(1);

    const st = await client.query<{ status: string }>(
      `SELECT status::text AS status FROM employees WHERE id='${emp}'::uuid`);
    expect(st.rows[0].status).toBe('PERMANENT');
  });

  it('offboarding → notifikasi OFFBOARDING_INITIATED & SEVERANCE_PAID saat pencairan', async () => {
    const emp = 'b0000000-0000-4000-8000-000000000004'; // Budi Pratama
    await client.exec(`
      DELETE FROM severance_calculations WHERE offboarding_request_id IN (SELECT id FROM offboarding_requests WHERE employee_id='${emp}');
      DELETE FROM knowledge_handovers WHERE offboarding_request_id IN (SELECT id FROM offboarding_requests WHERE employee_id='${emp}');
      DELETE FROM offboarding_requests WHERE employee_id='${emp}';
      UPDATE employees SET status='PERMANENT', last_working_day=NULL WHERE id='${emp}';
    `);
    const req = await createOffboardingRequest(db, HR_SESSION, {
      employeeId: emp,
      reasonForLeaving: 'Resign',
      resignationNoticeDate: '2026-11-01',
      lastWorkingDay: '2026-12-01',
    });
    expect(await notifCount(emp, 'OFFBOARDING_INITIATED')).toBe(1);

    const handovers = await selectHandoversByRequest(db, req.id);
    for (const h of handovers) await verifyHandoverItem(db, HR_SESSION, h.id);
    const sv = await calculateOffboardingSeverance(db, HR_SESSION, req.id, 'EFFICIENCY');
    await disburseSeverance(db, HR_SESSION, sv.id);
    expect(await notifCount(emp, 'SEVERANCE_PAID')).toBe(1);
  });
});
