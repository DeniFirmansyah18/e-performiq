import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { convertHiredCandidate } from '@/lib/services/candidateConversionService';
import { extendOffer } from '@/lib/services/offerService';
import { ensureActiveAppraisalPeriod } from '@/lib/services/appraisalService';
import { hashPassword } from '@/lib/auth/password';

describe('WS-7 auto-assign KPI pembuka + periode penilaian aktif saat onboarding', () => {
  let client: PGlite;
  let db: any;
  let postingId: string;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
    const q = await client.query<{ id: string }>(
      `SELECT id FROM job_postings WHERE position_id = 'a0000000-0000-4000-8000-000000000204' LIMIT 1`);
    postingId = q.rows[0].id;
  });
  afterAll(async () => { await client.close(); });

  async function makeCandidate(email: string): Promise<string> {
    const hash = await hashPassword('rahasia123');
    const acc = await client.query<{ id: string }>(
      `INSERT INTO candidate_accounts (email, password_hash, full_name, is_verified)
       VALUES ($1, $2, 'Kandidat KPI', TRUE) RETURNING id`, [email, hash]);
    const cand = await client.query<{ id: string }>(
      `INSERT INTO candidates (full_name, email, account_id) VALUES ('Kandidat KPI', $1, $2) RETURNING id`,
      [email, acc.rows[0].id]);
    const app = await client.query<{ id: string }>(
      `INSERT INTO job_applications (application_no, candidate_id, job_posting_id, status)
       VALUES ($1, $2, $3, 'INTERVIEW'::application_status_enum) RETURNING id`,
      [`APP-KPI-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, cand.rows[0].id, postingId]);
    return app.rows[0].id;
  }

  it('ensureActiveAppraisalPeriod mengembalikan periode ACTIVE (dari seed)', async () => {
    const period = await ensureActiveAppraisalPeriod(db);
    expect(period).toBeTruthy();
    expect(period.status).toBe('ACTIVE');
  });

  it('konversi kandidat menanam KPI pembuka sesuai template jabatan (bobot total 100%)', async () => {
    const email = `kpi.${Date.now()}@example.com`;
    const applicationId = await makeCandidate(email);
      // ADR 023: konversi hanya sah bila ada penawaran dengan gaji tercatat.
      await extendOffer(db, {
        applicationId,
        offeredByUserId: null,
        baseSalary: 28500000,
        responseDays: 7,
      });
      const res = await convertHiredCandidate(db, { applicationId });

    const kpis = await client.query<{ kpi_title: string; kpi_weight: string; status: string }>(
      `SELECT kpi_title, kpi_weight::text AS kpi_weight, status::text AS status
         FROM individual_kpis WHERE employee_id = $1::uuid ORDER BY kpi_weight DESC`, [res.employeeId]);
    // Jabatan Senior Software Engineer punya template 3 KPI (position_kpi_templates).
    expect(kpis.rows.length).toBeGreaterThanOrEqual(3);
    const total = kpis.rows.reduce((s, r) => s + Number(r.kpi_weight), 0);
    expect(total).toBe(100);
    expect(kpis.rows.every((r) => r.status === 'SUBMITTED')).toBe(true);

    // KPI tertaut ke pilar strategis (PRD §8).
    const linked = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM individual_kpis k
        JOIN strategic_pillars sp ON sp.id = k.strategic_pillar_id
       WHERE k.employee_id = $1::uuid`, [res.employeeId]);
    expect(Number(linked.rows[0].n)).toBe(kpis.rows.length);
  });

  it('idempoten: konversi ulang tidak menggandakan KPI', async () => {
    const email = `kpi.idem.${Date.now()}@example.com`;
    const applicationId = await makeCandidate(email);
      await extendOffer(db, {
        applicationId,
        offeredByUserId: null,
        baseSalary: 28500000,
        responseDays: 7,
      });
      const first = await convertHiredCandidate(db, { applicationId });
    const baseline = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM individual_kpis WHERE employee_id = $1::uuid`, [first.employeeId]);
    await convertHiredCandidate(db, { applicationId });
    const n = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM individual_kpis WHERE employee_id = $1::uuid`, [first.employeeId]);
    expect(Number(n.rows[0].n)).toBe(Number(baseline.rows[0].n));
  });
});
