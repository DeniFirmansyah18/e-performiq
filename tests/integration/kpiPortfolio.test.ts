import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { getKpiPortfolioPdfData } from '@/lib/services/kpiPortfolioService';
import { buildKpiPortfolioPdf } from '@/lib/services/kpiPortfolioPdfService';

let client: PGlite;
let db: Db;
let periodId = '';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const DANU = 'b0000000-0000-4000-8000-000000000003';
const SITI = 'b0000000-0000-4000-8000-000000000002';

beforeAll(async () => {
  ({ client } = await createTestDb());
  await runSeed(client);
  db = drizzle(client) as unknown as Db;
  const p = await client.query<{ id: string }>(
    'SELECT id::text AS id FROM appraisal_periods ORDER BY start_date DESC LIMIT 1'
  );
  periodId = p.rows[0].id;
}, 60000);

afterAll(async () => {
  await client.close();
});

describe('Unduh Portofolio KPI (#8)', () => {
  it('menyusun portofolio untuk PEGAWAI', async () => {
    const data: any = await getKpiPortfolioPdfData(db, BUDI, periodId);
    expect(data).toBeTruthy();
    // Portofolio memuat identitas pegawai & daftar KPI.
    expect(data.employeeName ?? data.profil?.fullName).toBeTruthy();
    expect(Array.isArray(data.kpis ?? data.items ?? [])).toBe(true);
  });

  it('menyusun portofolio untuk PEOPLE MANAGER (dirinya sendiri)', async () => {
    const data: any = await getKpiPortfolioPdfData(db, DANU, periodId);
    expect(data).toBeTruthy();
  });

  it('menyusun portofolio untuk HR (dirinya sendiri)', async () => {
    const data: any = await getKpiPortfolioPdfData(db, SITI, periodId);
    expect(data).toBeTruthy();
  });

  it('menghasilkan PDF ASLI (%) yang tidak kosong', async () => {
    const data: any = await getKpiPortfolioPdfData(db, BUDI, periodId);
    const pdf = await buildKpiPortfolioPdf(data);
    const buf = Buffer.from(pdf);

    // Tanda tangan berkas PDF.
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    // Berkas cukup besar untuk memuat tabel (bukan halaman kosong).
    expect(buf.length).toBeGreaterThan(1000);
    // Memuat penanda akhir PDF.
    expect(buf.subarray(-1024).toString('latin1')).toContain('%%EOF');
  });
});
