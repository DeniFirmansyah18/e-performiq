import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { calculateWorkloadSummary } from '@/lib/services/workloadService';
import { sql } from 'drizzle-orm';

describe('Workload Service - Satuan Waktu & Intensitas Beban Kerja (TDD)', () => {
  let client: PGlite;
  let db: Db;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  });

  afterAll(async () => {
    await client.close();
  });

  it('menghitung rata-rata jam dan intensitas beban kerja dengan benar', async () => {
    const summary = await calculateWorkloadSummary(db);
    expect(summary).toBeDefined();
    expect(summary.averageIntensity).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(summary.employees)).toBe(true);
    expect(summary.employees.length).toBeGreaterThan(0);
  });

  it('mengidentifikasi karyawan yang memiliki entri timesheet dan status utilisasi', async () => {
    // Ambil 1 employee id dari seed
    const empRes = await db.execute(sql`SELECT id FROM employees LIMIT 1`);
    const empId = (empRes.rows[0] as { id: string }).id;

    // Masukkan entri timesheet uji (40 jam kerja = optimal, 50 jam = over-utilized)
    const today = new Date().toISOString().slice(0, 10);
    await db.execute(sql`
      INSERT INTO daily_timesheets (employee_id, work_date, regular_hours, overtime_hours, task_summary, approval_status)
      VALUES (${empId}::uuid, ${today}::date, 8.00, 2.00, 'Tugas optimasi modul', 'APPROVED')
      ON CONFLICT (employee_id, work_date) DO UPDATE
      SET regular_hours = 8.00, overtime_hours = 2.00
    `);

    const summary = await calculateWorkloadSummary(db);
    const target = summary.employees.find((e) => e.employeeId === empId);
    expect(target).toBeDefined();
    expect(target?.totalRegularHours).toBeGreaterThanOrEqual(8);
  });
});
