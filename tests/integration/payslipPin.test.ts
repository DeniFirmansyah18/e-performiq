import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { getPayslipDetail } from '@/lib/services/payrollService';

let client: PGlite;
let db: Db;


const PEGAWAI = 'b0000000-0000-4000-8000-000000000004'; // Budi
const PM = 'b0000000-0000-4000-8000-000000000003'; // Danu
const HR = 'b0000000-0000-4000-8000-000000000002'; // Siti
const BOD = 'b0000000-0000-4000-8000-000000000001'; // Hendra

beforeAll(async () => {
  ({ client } = await createTestDb());
  await runSeed(client);
  db = drizzle(client) as unknown as Db;
  // Jangan ikat ke satu run: slip tiap pegawai bisa berada di run berbeda.
  // Cukup pastikan ada run payroll di data seed.
  const r = await client.query<{ n: number }>('SELECT count(*)::int AS n FROM payroll_runs');
  expect(r.rows[0].n).toBeGreaterThan(0);
}, 60000);

/** Slip terbaru pegawai (tanpa runId agar mengambil periode terakhir). */
const slip = (id: string) => getPayslipDetail(db, id);

afterAll(async () => {
  await client.close();
});

describe('Slip Gaji PIN (#6)', () => {
  it('semua peran punya PIN slip gaji tersimpan (hash, bukan teks biasa)', async () => {
    const r = await client.query<{ id: string; hash: string | null }>(
      `SELECT id::text AS id, payslip_pin_hash AS hash FROM employees WHERE id = ANY($1::uuid[])`,
      [[PEGAWAI, PM, HR, BOD]]
    );
    expect(r.rows.length).toBe(4);
    for (const row of r.rows) {
      expect(row.hash, `PIN ${row.id.slice(-4)}`).toBeTruthy();
      // Hash harus jauh dari PIN asli (tidak disimpan terbuka).
      expect(row.hash).not.toBe('1234');
      expect(String(row.hash).length).toBeGreaterThan(20);
    }
  });

  it('PEGAWAI dapat membuka slip gajinya sesuai hitungan payroll', async () => {
    const s: any = await getPayslipDetail(db, PEGAWAI);
    expect(s).toBeTruthy();
    // Slip memuat angka payroll: bruto (gross), potongan, dan gaji bersih (net).
    const bruto = Number(s.gross ?? 0);
    const netto = Number(s.net ?? 0);
    const potongan = Number(s.totalDeductions ?? 0);
    expect(bruto).toBeGreaterThan(0);
    expect(netto).toBeGreaterThan(0);
    expect(netto).toBeLessThan(bruto);
    // Gaji bersih = bruto dikurangi total potongan (hitungan payroll konsisten).
    expect(Math.round(bruto - potongan)).toBe(Math.round(netto));
  });

  it('PEOPLE MANAGER, HR, dan BOD juga dapat membuka slip mereka sendiri', async () => {
    for (const [label, id] of [['PM', PM], ['HR', HR], ['BOD', BOD]] as const) {
      const s: any = await getPayslipDetail(db, id);
      expect(s, `slip ${label} belum ada di seed`).toBeTruthy();
      expect(Number(s.gross ?? 0), `bruto ${label}`).toBeGreaterThan(0);
      expect(Number(s.net ?? 0), `netto ${label}`).toBeGreaterThan(0);
    }
  });

  it('slip tiap peran berisi data orang yang berbeda', async () => {
    const b: any = await getPayslipDetail(db, PEGAWAI);
    const h: any = await getPayslipDetail(db, HR);
    const o: any = await getPayslipDetail(db, BOD);
    expect(b.fullName).not.toBe(h.fullName);
    expect(h.fullName).not.toBe(o.fullName);
    // Gaji BOD (direktur) lebih besar dari HR, sesuai hierarki.
    expect(Number(o.gross)).toBeGreaterThan(Number(h.gross));
  });
});
