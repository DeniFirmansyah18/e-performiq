import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';

const CO = 'c0000000-0000-4000-8000-000000000001';
const DEPT = 'c0000000-0000-4000-8000-000000000002';
const POS = 'c0000000-0000-4000-8000-000000000003';
const EMP = 'c0000000-0000-4000-8000-000000000004';

describe('Migrasi 0004: Absensi & Kotak 3 Talent Acquisition', () => {
  let client: PGlite;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await client.exec(`
      INSERT INTO companies (id, company_name, legal_entity_code)
        VALUES ('${CO}','PT Absen','ABS') ON CONFLICT DO NOTHING;
      INSERT INTO departments (id, company_id, department_name)
        VALUES ('${DEPT}','${CO}','Ops') ON CONFLICT DO NOTHING;
      INSERT INTO job_positions (id, department_id, position_title)
        VALUES ('${POS}','${DEPT}','Ops Staff') ON CONFLICT DO NOTHING;
      INSERT INTO employees (id, employee_code, full_name, email,
                             department_id, position_id, base_salary, join_date)
        VALUES ('${EMP}','EMP-ABS-01','Wira','wira@x.id',
                '${DEPT}','${POS}',9000000,'2024-01-01') ON CONFLICT DO NOTHING;
    `);
  });

  afterAll(async () => {
    await client.close();
  });

  it('membuat 4 tabel baru', async () => {
    const res = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('attendance_records','job_postings','internal_applications','interview_slots')`
    );
    expect(Number(res.rows[0].count)).toBe(4);
  });

  it('menolak check_out yang tidak lebih besar dari check_in', async () => {
    await expect(
      client.query(
        `INSERT INTO attendance_records (employee_id, work_date, check_in, check_out)
         VALUES ('${EMP}','2026-09-28','17:00','08:00');`
      )
    ).rejects.toThrow();
  });

  it('menolak lembur melebihi 4 jam per hari (PP 35/2021 Pasal 26)', async () => {
    await expect(
      client.query(
        `INSERT INTO attendance_records (employee_id, work_date, check_in, check_out, total_overtime_hours)
         VALUES ('${EMP}','2026-09-29','08:00','20:30',4.5);`
      )
    ).rejects.toThrow();
  });

  it('menerapkan deduplikasi satu baris absensi per karyawan per hari', async () => {
    await client.query(
      `INSERT INTO attendance_records (employee_id, work_date, check_in, check_out)
       VALUES ('${EMP}','2026-09-30','08:00','17:00') ON CONFLICT DO NOTHING;`
    );
    await expect(
      client.query(
        `INSERT INTO attendance_records (employee_id, work_date, check_in, check_out)
         VALUES ('${EMP}','2026-09-30','09:00','18:00');`
      )
    ).rejects.toThrow();
  });
});
