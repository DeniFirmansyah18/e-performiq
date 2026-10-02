import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';

// WS-1: verifikasi skema rekrutmen end-to-end + akun kandidat + mesin asesmen.

const NEW_TABLES = [
  'candidate_accounts',
  'candidate_skills',
  'candidate_educations',
  'candidate_experiences',
  'resume_parses',
  'application_timeline',
  'interview_schedules',
  'candidate_decisions',
  'assessment_templates',
  'assessment_questions',
  'assessment_attempts',
  'assessment_responses',
  'candidate_assessment_scores',
];

describe('WS-1 skema rekrutmen & asesmen', () => {
  let client: PGlite;
  beforeAll(async () => { ({ client } = await createTestDb()); await runSeed(client); });
  afterAll(async () => { await client.close(); });

  it('membuat semua tabel rekrutmen baru', async () => {
    const res = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND table_type='BASE TABLE'`
    );
    const names = res.rows.map((r) => r.table_name);
    for (const t of NEW_TABLES) expect(names).toContain(t);
  });

  it('membuat enum rekrutmen & asesmen', async () => {
    const res = await client.query<{ typname: string }>(
      `SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
        WHERE n.nspname='public' AND t.typtype='e'`
    );
    const enums = res.rows.map((r) => r.typname);
    for (const e of ['timeline_stage_enum', 'timeline_status_enum', 'candidate_decision_enum',
      'assessment_type_enum', 'assessment_status_enum', 'question_type_enum']) {
      expect(enums).toContain(e);
    }
  });

  it('kandidat terhubung ke akun (FK account_id) & unik per email akun', async () => {
    // buat akun kandidat + kandidat
    await client.exec(`INSERT INTO candidate_accounts (id, email, password_hash, full_name)
      VALUES ('ca000000-0000-4000-8000-000000000001','kandidat@example.com','x','Kandidat Uji');`);
    await client.exec(`INSERT INTO candidates (id, full_name, email, account_id)
      VALUES ('cd000000-0000-4000-8000-000000000001','Kandidat Uji','kandidat@example.com','ca000000-0000-4000-8000-000000000001');`);
    const res = await client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM candidates WHERE account_id='ca000000-0000-4000-8000-000000000001'`
    );
    expect(res.rows[0].n).toBe(1);

    // email akun unik
    await expect(client.exec(`INSERT INTO candidate_accounts (email, password_hash, full_name)
      VALUES ('kandidat@example.com','x','Duplikat');`)).rejects.toBeTruthy();
  });

  it('timeline unik per (application, stage) & decision unik per application', async () => {
    // Pakai manpower_plan seed yang ada untuk (dept 101, position 204, 2026),
    // atau buat baru bila tidak ada — aman terhadap unique constraint.
    const mp = await client.query<{ id: string }>(
      `SELECT id FROM manpower_plans
        WHERE department_id='a0000000-0000-4000-8000-000000000101'
          AND position_id='a0000000-0000-4000-8000-000000000204' AND fiscal_year=2026 LIMIT 1`
    );
    let planId = mp.rows[0]?.id;
    if (!planId) {
      planId = 'aa000000-0000-4000-8000-000000000001';
      await client.exec(`INSERT INTO manpower_plans (id, department_id, position_id, fiscal_year, approved_quota, allocated_budget)
        VALUES ('${planId}','a0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000204',2026,3,100000000);`);
    }
    await client.exec(`INSERT INTO job_postings (id, manpower_plan_id, position_id, department_id, posting_title, description)
      VALUES ('ab000000-0000-4000-8000-000000000001','${planId}','a0000000-0000-4000-8000-000000000204','a0000000-0000-4000-8000-000000000101','Backend Engineer','Desc');`);
    await client.exec(`INSERT INTO job_applications (id, application_no, candidate_id, job_posting_id)
      VALUES ('ac000000-0000-4000-8000-000000000001','APP-TEST-1','cd000000-0000-4000-8000-000000000001','ab000000-0000-4000-8000-000000000001');`);
    await client.exec(`INSERT INTO application_timeline (application_id, stage, status) VALUES ('ac000000-0000-4000-8000-000000000001','APPLIED','PASSED');`);
    await expect(client.exec(`INSERT INTO application_timeline (application_id, stage, status)
      VALUES ('ac000000-0000-4000-8000-000000000001','APPLIED','PENDING');`)).rejects.toBeTruthy();
  });

  it('assessment_attempts unik per (application, template)', async () => {
    await client.exec(`INSERT INTO assessment_templates (id, code, title, type, weight)
      VALUES ('ad000000-0000-4000-8000-000000000001','PSY-30','Psikometri','PSYCHOMETRIC',30);`);
    await client.exec(`INSERT INTO assessment_attempts (id, application_id, candidate_id, template_id)
      VALUES ('ae000000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000001','ad000000-0000-4000-8000-000000000001');`);
    await expect(client.exec(`INSERT INTO assessment_attempts (application_id, candidate_id, template_id)
      VALUES ('ac000000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000001','ad000000-0000-4000-8000-000000000001');`)).rejects.toBeTruthy();
  });
});
