import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';

describe('Govera360 Database Schema Extension (0003)', () => {
  let client: PGlite;

  beforeAll(async () => {
    ({ client } = await createTestDb());
  });

  afterAll(async () => {
    await client.close();
  });

  it('memiliki seluruh 7 tabel baru untuk arsitektur 6 kotak Govera360', async () => {
    const newTables = [
      'daily_timesheets',
      'kpi_evidence_attachments',
      'career_path_levels',
      'moodle_course_enrollments',
      'leave_requests',
      'expense_claims',
      'helpdesk_tickets',
    ];

    for (const table of newTables) {
      const res = await client.query<{ exists: boolean }>(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        );`,
        [table]
      );
      expect(res.rows[0].exists).toBe(true);
    }
  });

  it('memvalidasi batasan lembur maksimal 4 jam pada daily_timesheets sesuai PP 35/2021', async () => {
    // Arrange: minimal graph agar FK terpenuhi
    await client.exec(`
      INSERT INTO companies (id, company_name, legal_entity_code)
        VALUES ('11111111-1111-1111-1111-111111111111','PT Govera','GOV');
      INSERT INTO departments (id, company_id, department_name)
        VALUES ('22222222-2222-2222-2222-222222222222',
                '11111111-1111-1111-1111-111111111111','Engineering');
      INSERT INTO job_positions (id, department_id, position_title)
        VALUES ('33333333-3333-3333-3333-333333333333',
                '22222222-2222-2222-2222-222222222222','Software Engineer');
      INSERT INTO employees (id, employee_code, full_name, email,
                             department_id, position_id, base_salary, join_date)
        VALUES ('44444444-4444-4444-4444-444444444444','EMP-GOV-01','Budi Pekerja','budi.gov@x.id',
                '22222222-2222-2222-2222-222222222222',
                '33333333-3333-3333-3333-333333333333', 12000000, '2024-01-01');
    `);

    // Valid: lembur 3.5 jam (dibolehkan PP 35/2021)
    await client.query(
      `INSERT INTO daily_timesheets (employee_id, work_date, regular_hours, overtime_hours, task_summary)
       VALUES ('44444444-4444-4444-4444-444444444444', '2026-09-25', 8.00, 3.50, 'Penyelesaian sprint backlog');`
    );

    // Invalid: lembur 4.5 jam (melanggar batas maks 4.0 jam PP 35/2021)
    await expect(
      client.query(
        `INSERT INTO daily_timesheets (employee_id, work_date, regular_hours, overtime_hours, task_summary)
         VALUES ('44444444-4444-4444-4444-444444444444', '2026-09-26', 8.00, 4.50, 'Lembur berlebih ilegal');`
      )
    ).rejects.toThrow();
  });
});
