import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';

const EXPECTED_TABLES = [
  'appraisal_periods', 'attendance_records', 'audit_logs', 'career_path_levels', 'companies', 'company_vision_mission', 'competency_scores',
  'corporate_kpis', 'daily_timesheets', 'departments', 'division_kpis', 'employees',
  'expense_claims', 'helpdesk_tickets', 'hiring_requisitions', 'individual_kpis', 'industry_benchmarks', 'internal_applications',
  'interview_slots', 'job_positions', 'job_postings',
  'knowledge_handovers', 'kpi_evidence_attachments', 'leave_requests', 'lifetime_contributions',
  'manpower_plans', 'moodle_course_enrollments', 'offboarding_requests', 'onboarding_milestones',
  'peer_reviews_360', 'performance_appraisals', 'policy_knowledge_base', 'recruitment_assessments',
  'severance_calculations', 'sop_compliance_logs', 'strategic_pillars',
  'users', 'vmai_scorecards',
].sort();

describe('skema database', () => {
  let client: PGlite;

  beforeAll(async () => {
    ({ client } = await createTestDb());
  });

  afterAll(async () => {
    await client.close();
  });

  it('membuat tepat 38 tabel di schema public (24 PRD + 7 Govera360 + 4 Kotak 3 & Absensi + 3 referensi/KB)', async () => {
    const res = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
          AND table_name != '__migrations'
        ORDER BY table_name`
    );
    const names = res.rows.map((r) => r.table_name).sort();
    expect(names).toEqual(EXPECTED_TABLES);
  });

  it('membuat 7 enum', async () => {
    const res = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typtype = 'e'`
    );
    expect(Number(res.rows[0].count)).toBe(7);
  });

  it('menghitung achievement_percentage otomatis', async () => {
    // Arrange: minimal graph agar FK terpenuhi
    await client.exec(`
      INSERT INTO companies (id, company_name, legal_entity_code)
        VALUES ('11111111-1111-1111-1111-111111111111','PT Uji','UJI');
      INSERT INTO departments (id, company_id, department_name)
        VALUES ('22222222-2222-2222-2222-222222222222',
                '11111111-1111-1111-1111-111111111111','TI');
      INSERT INTO job_positions (id, department_id, position_title)
        VALUES ('33333333-3333-3333-3333-333333333333',
                '22222222-2222-2222-2222-222222222222','Engineer');
      INSERT INTO employees (id, employee_code, full_name, email,
                             department_id, position_id, base_salary, join_date)
        VALUES ('44444444-4444-4444-4444-444444444444','E-001','Uji','uji@x.id',
                '22222222-2222-2222-2222-222222222222',
                '33333333-3333-3333-3333-333333333333', 10000000, '2024-01-01');
      INSERT INTO strategic_pillars (id, company_id, perspective, pillar_name,
                                     strategic_weight)
        VALUES ('55555555-5555-5555-5555-555555555555',
                '11111111-1111-1111-1111-111111111111','FINANCIAL','Pilar Uji',25);
      INSERT INTO appraisal_periods (id, period_code, start_date, end_date)
        VALUES ('66666666-6666-6666-6666-666666666666','2026-Q3',
                '2026-07-01','2026-09-30');
    `);

    // Act
    await client.exec(`
      INSERT INTO individual_kpis (period_id, employee_id, strategic_pillar_id,
                                   kpi_title, target_value, actual_value, kpi_weight)
        VALUES ('66666666-6666-6666-6666-666666666666',
                '44444444-4444-4444-4444-444444444444',
                '55555555-5555-5555-5555-555555555555',
                'KPI Uji', 200, 185, 50);
    `);

    // Assert
    const res = await client.query<{ achievement_percentage: string }>(
      `SELECT achievement_percentage FROM individual_kpis WHERE kpi_title = 'KPI Uji'`
    );
    expect(Number(res.rows[0].achievement_percentage)).toBeCloseTo(92.5, 2);
  });

  it('menolak UPDATE pada audit_logs', async () => {
    await client.exec(`
      INSERT INTO audit_logs (action_type, entity_name, record_id, description)
        VALUES ('CREATE','uji','rec-1','uji');
    `);

    await expect(
      client.exec(`UPDATE audit_logs SET description = 'diubah' WHERE record_id = 'rec-1'`)
    ).rejects.toThrow(/immutable/i);
  });
});
