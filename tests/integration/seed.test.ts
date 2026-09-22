import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed, SEED_USER_EMAILS, DEMO_PASSWORD } from '@/lib/db/seed';
import { verifyPassword } from '@/lib/auth/password';

describe('seed data', () => {
  let client: PGlite;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
  });

  afterAll(async () => {
    await client.close();
  });

  it('membuat 6 user, satu per role', async () => {
    const res = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM users');
    expect(Number(res.rows[0].count)).toBe(6);
    expect(SEED_USER_EMAILS).toHaveLength(6);
  });

  it('menyimpan password sebagai hash bcrypt yang cocok dengan password demo', async () => {
    const res = await client.query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE email = $1',
      [SEED_USER_EMAILS[0].email]
    );
    expect(res.rows[0].password_hash).not.toContain(DEMO_PASSWORD);
    expect(await verifyPassword(DEMO_PASSWORD, res.rows[0].password_hash)).toBe(true);
  });

  it('membuat 4 pilar strategis dengan total bobot 100', async () => {
    const res = await client.query<{ total: string }>(
      'SELECT sum(strategic_weight)::text AS total FROM strategic_pillars'
    );
    expect(Number(res.rows[0].total)).toBe(100);
  });

  it('membuat 4 KPI milik Budi dengan total bobot 100', async () => {
    const res = await client.query<{ total: string; count: string }>(
      'SELECT sum(kpi_weight)::text AS total, count(*)::text AS count FROM individual_kpis'
    );
    expect(Number(res.rows[0].count)).toBe(4);
    expect(Number(res.rows[0].total)).toBe(100);
  });

  it('menetapkan manager_id Budi ke Danu', async () => {
    const res = await client.query<{ manager_code: string }>(
      `SELECT m.employee_code AS manager_code FROM employees e
         JOIN employees m ON m.id = e.manager_id
        WHERE e.employee_code = 'EMP-2022-0042'`
    );
    expect(res.rows[0].manager_code).toBe('MGR-2020-0001');
  });

  it('idempoten: seed kedua tidak menggandakan baris', async () => {
    await runSeed(client);
    const res = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM users');
    expect(Number(res.rows[0].count)).toBe(6);
  });

  it('memverifikasi keberadaan data pada seluruh 9 tabel Pre/Post-Employment & Analytics', async () => {
    const tables = [
      'manpower_plans', 'hiring_requisitions', 'recruitment_assessments',
      'onboarding_milestones', 'offboarding_requests', 'knowledge_handovers',
      'severance_calculations', 'lifetime_contributions', 'vmai_scorecards'
    ];
    for (const t of tables) {
      const res = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM ${t}`);
      expect(Number(res.rows[0].count)).toBeGreaterThan(0);
    }
  });
});
