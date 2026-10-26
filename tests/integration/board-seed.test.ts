import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';

describe('Seed data operasional Boardroom', () => {
  let client: PGlite;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
  }, 60000);

  afterAll(async () => {
    await client.close();
  });

  const count = async (table: string): Promise<number> => {
    const r = await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`);
    return r.rows[0].n;
  };

  it('menyediakan event aktivitas lintas tipe dan peran', async () => {
    expect(await count('activity_events')).toBeGreaterThanOrEqual(10);
    const types = await client.query<{ n: number }>(
      `SELECT count(DISTINCT event_type)::int AS n FROM activity_events`
    );
    expect(types.rows[0].n).toBeGreaterThanOrEqual(4);
  });

  it('menyediakan minimal satu event RESTRICTED untuk menguji pengecualian', async () => {
    const r = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM activity_events WHERE visibility = 'RESTRICTED'`
    );
    expect(r.rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it('menyediakan run payroll beserta itemnya', async () => {
    expect(await count('payroll_runs')).toBeGreaterThanOrEqual(1);
    expect(await count('payroll_items')).toBeGreaterThanOrEqual(3);
    const r = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM payroll_items WHERE net > 0`
    );
    expect(r.rows[0].n).toBeGreaterThanOrEqual(3);
  });

  it('total run payroll konsisten dengan jumlah itemnya', async () => {
    const r = await client.query<{ run_id: string; selisih_gross: number; selisih_net: number }>(
      `SELECT pr.id AS run_id,
              (pr.total_gross - COALESCE(SUM(pi.gross), 0))::float8 AS selisih_gross,
              (pr.total_net - COALESCE(SUM(pi.net), 0))::float8 AS selisih_net
         FROM payroll_runs pr
         LEFT JOIN payroll_items pi ON pi.run_id = pr.id
        GROUP BY pr.id, pr.total_gross, pr.total_net`
    );
    expect(r.rows.length).toBeGreaterThan(0);
    for (const row of r.rows) {
      expect(Math.abs(Number(row.selisih_gross))).toBeLessThan(0.01);
      expect(Math.abs(Number(row.selisih_net))).toBeLessThan(0.01);
    }
  });

  it('menyediakan kartu BPJS terisi dan yang masih kosong', async () => {
    expect(await count('employee_social_security')).toBeGreaterThanOrEqual(2);
    const withNumber = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM employee_social_security WHERE bpjs_kes_number IS NOT NULL`
    );
    expect(withNumber.rows[0].n).toBeGreaterThanOrEqual(2);
  });

  it('menyediakan pengajuan lembur termasuk yang menunggu persetujuan', async () => {
    expect(await count('overtime_requests')).toBeGreaterThanOrEqual(2);
    const pending = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM overtime_requests WHERE status = 'SUBMITTED'`
    );
    expect(pending.rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it('idempoten: seed kedua tidak menggandakan baris', async () => {
    const before = {
      activity: await count('activity_events'),
      runs: await count('payroll_runs'),
      items: await count('payroll_items'),
      bpjs: await count('employee_social_security'),
      overtime: await count('overtime_requests'),
    };

    await runSeed(client);

    expect(await count('activity_events')).toBe(before.activity);
    expect(await count('payroll_runs')).toBe(before.runs);
    expect(await count('payroll_items')).toBe(before.items);
    expect(await count('employee_social_security')).toBe(before.bpjs);
    expect(await count('overtime_requests')).toBe(before.overtime);
  });
});
