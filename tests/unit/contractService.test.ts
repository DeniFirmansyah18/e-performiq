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

    const refDate = '2026-10-25';
    const targetDate = '2026-11-14'; // 20 hari dari 25 Okt
    await db.execute(sql`
      UPDATE employees
      SET status = 'CONTRACT', contract_end_date = ${targetDate}::date
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
});
