import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { convertHiredCandidate } from '@/lib/services/candidateConversionService';
import { updateApplicationStatus } from '@/lib/services/candidateService';
import { hashPassword } from '@/lib/auth/password';

describe('WS-7 konversi kandidat HIRED → karyawan', () => {
  let client: PGlite;
  let db: any;
  let postingId: string;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
    const q = await client.query<{ id: string }>(`SELECT id FROM job_postings LIMIT 1`);
    postingId = q.rows[0].id;
  });
  afterAll(async () => { await client.close(); });

  async function makeCandidate(email: string): Promise<{ accountId: string; candidateId: string; applicationId: string }> {
    const hash = await hashPassword('rahasia123');
    const acc = await client.query<{ id: string }>(
      `INSERT INTO candidate_accounts (email, password_hash, full_name, is_verified)
       VALUES ($1, $2, 'Kandidat Konversi', TRUE) RETURNING id`, [email, hash]);
    const accountId = acc.rows[0].id;
    const cand = await client.query<{ id: string }>(
      `INSERT INTO candidates (full_name, email, account_id) VALUES ('Kandidat Konversi', $1, $2) RETURNING id`,
      [email, accountId]);
    const candidateId = cand.rows[0].id;
    const app = await client.query<{ id: string }>(
      `INSERT INTO job_applications (application_no, candidate_id, job_posting_id, status)
       VALUES ($1, $2, $3, 'INTERVIEW'::application_status_enum) RETURNING id`,
      [`APP-KONV-${Date.now()}`, candidateId, postingId]);
    return { accountId, candidateId, applicationId: app.rows[0].id };
  }

  it('membuat employees + users, nonaktifkan akun kandidat', async () => {
    const email = `konversi.${Date.now()}@example.com`;
    const { accountId, applicationId } = await makeCandidate(email);

    const res = await convertHiredCandidate(db, { applicationId });
    expect(res.created).toBe(true);
    expect(res.employeeId).toBeTruthy();
    expect(res.userId).toBeTruthy();

    const emp = await client.query<{ full_name: string; status: string; department_id: string }>(
      `SELECT full_name, status::text AS status, department_id FROM employees WHERE id = $1::uuid`, [res.employeeId]);
    expect(emp.rows[0].full_name).toBe('Kandidat Konversi');
    expect(emp.rows[0].status).toBe('PROBATION');

    const usr = await client.query<{ email: string; role: string; is_active: boolean; password_hash: string }>(
      `SELECT email, role::text AS role, is_active, password_hash FROM users WHERE id = $1::uuid`, [res.userId]);
    expect(usr.rows[0].email).toBe(email.toLowerCase());
    expect(usr.rows[0].role).toBe('EMPLOYEE');
    expect(usr.rows[0].is_active).toBe(true);
    // password di-copy dari kandidat (hash valid, bukan string kosong).
    expect(usr.rows[0].password_hash.length).toBeGreaterThan(20);

    const acc = await client.query<{ is_active: boolean }>(
      `SELECT is_active FROM candidate_accounts WHERE id = $1::uuid`, [accountId]);
    expect(acc.rows[0].is_active).toBe(false);
  });

  it('idempoten: panggil ulang tidak menduplikasi users', async () => {
    const email = `konversi2.${Date.now()}@example.com`;
    const { applicationId } = await makeCandidate(email);
    const first = await convertHiredCandidate(db, { applicationId });
    const second = await convertHiredCandidate(db, { applicationId });
    expect(second.created).toBe(false);
    expect(second.employeeId).toBe(first.employeeId);
    const n = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM users WHERE LOWER(email) = $1`, [email.toLowerCase()]);
    expect(Number(n.rows[0].n)).toBe(1);
  });

  it('updateApplicationStatus HIRED memicu provisioning', async () => {
    const email = `konversi3.${Date.now()}@example.com`;
    const { applicationId } = await makeCandidate(email);
    await updateApplicationStatus(db, applicationId, 'HIRED');
    const usr = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM users WHERE LOWER(email) = $1`, [email.toLowerCase()]);
    expect(Number(usr.rows[0].n)).toBe(1);
  });
});
