import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { getContractsSummary } from '@/lib/services/contractService';
import { sql } from 'drizzle-orm';

describe('Contract Service - Manajemen & Peringatan Jatuh Tempo PKWT (TDD)', () => {
  let client: PGlite;
  let db: Db;
  const refDate = '2026-10-25';

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  }, 60000);

  afterAll(async () => {
    await client.close();
  });

  it('mengembalikan ringkasan kontrak PKWT dan mengidentifikasi jatuh tempo', async () => {
    // Pastikan ada setidaknya 1 karyawan kontrak di DB test
    const empRes = await db.execute(sql`
      SELECT id FROM employees LIMIT 1
    `);
    const empId = (empRes.rows[0] as { id: string }).id;

    const targetDate = '2026-11-14'; // 20 hari dari 25 Okt
    await db.execute(sql`
      UPDATE employees
      SET status = 'CONTRACT', employment_status = 'PKWT', contract_end_date = ${targetDate}::date
      WHERE id = ${empId}::uuid
    `);

    const summary = await getContractsSummary(db, refDate);
    expect(summary).toBeDefined();
    expect(summary.totalPkwt).toBeGreaterThanOrEqual(1);

    const alertItem = summary.alerts.find((a) => a.employeeId === empId);
    expect(alertItem).toBeDefined();
    expect(alertItem?.urgency).toBe('CRITICAL_30');
    expect(alertItem?.daysRemaining).toBe(20);
  });

  it('mengabaikan karyawan non-PKWT (TETAP/PKWTT/PROBATION) dari peringatan jatuh tempo', async () => {
    const empRes = await db.execute(sql`
      INSERT INTO employees (employee_code, full_name, email, department_id, position_id,
                             status, employment_status, base_salary, join_date, contract_end_date)
      VALUES ('TEST-TETAP-1', 'Pegawai Tetap Uji', 'tetap.uji@eperformiq.co.id',
              'a0000000-0000-4000-8000-000000000101'::uuid,
              'a0000000-0000-4000-8000-000000000204'::uuid,
              'PERMANENT', 'TETAP', 9000000, CURRENT_DATE, '2026-11-01'::date)
      RETURNING id
    `);
    const tetapId = (empRes.rows[0] as { id: string }).id;

    const summary = await getContractsSummary(db, refDate);
    expect(summary.alerts.some((a) => a.employeeId === tetapId)).toBe(false);
  });

  it('mendeteksi PKWT lewat employment_status v2 walau kolom status masih PROBATION', async () => {
    const empRes = await db.execute(sql`
      INSERT INTO employees (employee_code, full_name, email, department_id, position_id,
                             status, employment_status, base_salary, join_date, contract_end_date)
      VALUES ('TEST-PKWT-2', 'Pegawai PKWT Uji', 'pkwt.uji@eperformiq.co.id',
              'a0000000-0000-4000-8000-000000000101'::uuid,
              'a0000000-0000-4000-8000-000000000204'::uuid,
              'PROBATION', 'PKWT', 9000000, CURRENT_DATE, '2026-11-04'::date)
      RETURNING id
    `);
    const pkwtId = (empRes.rows[0] as { id: string }).id;

    const summary = await getContractsSummary(db, refDate);
    const alertItem = summary.alerts.find((a) => a.employeeId === pkwtId);
    expect(alertItem).toBeDefined();
    expect(alertItem?.daysRemaining).toBe(10);
    expect(alertItem?.urgency).toBe('CRITICAL_30');
  });
  it('menyertakan tanggal mulai kontrak bila kolom contract_start_date tersedia', async () => {
    const empRes = await db.execute(sql`
      INSERT INTO employees (employee_code, full_name, email, department_id, position_id,
                             status, employment_status, base_salary, join_date,
                             contract_start_date, contract_end_date)
      VALUES ('TEST-PKWT-3', 'Pegawai PKWT Mulai', 'pkwt.mulai@eperformiq.co.id',
              'a0000000-0000-4000-8000-000000000101'::uuid,
              'a0000000-0000-4000-8000-000000000204'::uuid,
              'PROBATION', 'PKWT', 9000000, CURRENT_DATE,
              '2026-01-01'::date, '2026-12-31'::date)
      RETURNING id
    `);
    const pkwtId = (empRes.rows[0] as { id: string }).id;

    const summary = await getContractsSummary(db, refDate);
    const alertItem = summary.alerts.find((a) => a.employeeId === pkwtId);
    expect(alertItem?.contractStartDate).toBe('2026-01-01');
    expect(alertItem?.contractEndDate).toBe('2026-12-31');
  });
});
