import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';

let client: PGlite;

beforeAll(async () => {
  ({ client } = await createTestDb());
  await runSeed(client);
}, 60000);

afterAll(async () => { await client.close(); });

/**
 * Setiap karyawan aktif di seed semestinya punya data BPJS; kalau tidak,
 * kartu BPJS-nya tampil "belum terdaftar" dan menimbulkan kesan aplikasi rusak.
 */
describe('kelengkapan data BPJS pada seed', () => {
  it('seluruh karyawan aktif punya baris BPJS terdaftar', async () => {
    const r = await client.query<{ kode: string }>(
      `SELECT e.employee_code AS kode
         FROM employees e
         LEFT JOIN employee_social_security ss ON ss.employee_id = e.id
        WHERE e.status IN ('PERMANENT','PROBATION','CONTRACT')
          AND ss.employee_id IS NULL
        ORDER BY e.employee_code`
    );
    expect(r.rows.map((x) => x.kode)).toEqual([]);
  });

  it('HR Manager dan CEO termasuk yang terdaftar', async () => {
    const r = await client.query<{ kode: string }>(
      `SELECT e.employee_code AS kode
         FROM employees e
         JOIN employee_social_security ss ON ss.employee_id = e.id
        WHERE e.employee_code IN ('HRM-2018-0002','CEO-2019-0001')
        ORDER BY e.employee_code`
    );
    expect(r.rows.map((x) => x.kode)).toEqual(['CEO-2019-0001', 'HRM-2018-0002']);
  });
});
