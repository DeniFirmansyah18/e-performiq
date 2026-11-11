import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { approveKpi } from '@/lib/services/kpiService';

const PERIODE = 'd0000000-0000-4000-8000-000000000001';
const PILLAR = 'c0000000-0000-4000-8000-000000000001';

const SITI_USER = 'e0000000-0000-4000-8000-000000000002';
const SITI_EMP = 'b0000000-0000-4000-8000-000000000002';
const DANU_USER = 'e0000000-0000-4000-8000-000000000003';
const DANU_EMP = 'b0000000-0000-4000-8000-000000000003';
const HENDRA_USER = 'e0000000-0000-4000-8000-000000000001';
const HENDRA_EMP = 'b0000000-0000-4000-8000-000000000001';
const BUDI_EMP = 'b0000000-0000-4000-8000-000000000004';

let client: PGlite;
let db: Db;

beforeAll(async () => {
  ({ client } = await createTestDb());
  await runSeed(client);
  db = drizzle(client) as unknown as Db;
}, 60000);

afterAll(async () => { await client.close(); });

/** Buat KPI baru berstatus SUBMITTED untuk karyawan tertentu. */
async function buatKpi(employeeId: string, judul: string): Promise<string> {
  const r = await client.query<{ id: string }>(
    `INSERT INTO individual_kpis
       (id, period_id, employee_id, strategic_pillar_id, kpi_title, target_value, actual_value,
        unit_of_measure, kpi_weight, status)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, 100, 50, '%', 20, 'SUBMITTED')
     RETURNING id`,
    [PERIODE, employeeId, PILLAR, judul]
  );
  return r.rows[0].id;
}

/**
 * Persetujuan KPI adalah tindakan menilai orang lain, jadi tidak boleh
 * dilakukan terhadap KPI milik sendiri — termasuk oleh HR dan People Manager
 * yang memegang `kpi:approve`.
 */
describe('tidak boleh menyetujui KPI milik sendiri', () => {
  it('HR tidak boleh menyetujui KPI miliknya sendiri', async () => {
    const kpiId = await buatKpi(SITI_EMP, 'KPI milik Siti (HR)');
    const sesi = { userId: SITI_USER, employeeId: SITI_EMP, role: 'HR_MANAGER', email: 's@x.id' } as any;
    await expect(approveKpi(db, sesi, kpiId)).rejects.toThrow(/sendiri/i);
  });

  it('People Manager tidak boleh menyetujui KPI miliknya sendiri', async () => {
    const kpiId = await buatKpi(DANU_EMP, 'KPI milik Danu (PM)');
    const sesi = { userId: DANU_USER, employeeId: DANU_EMP, role: 'PEOPLE_MANAGER', email: 'd@x.id' } as any;
    await expect(approveKpi(db, sesi, kpiId)).rejects.toThrow(/sendiri/i);
  });

  it('atasan langsung tetap boleh menyetujui KPI bawahannya', async () => {
    const kpiId = await buatKpi(SITI_EMP, 'KPI Siti yang disetujui CEO');
    const sesi = { userId: HENDRA_USER, employeeId: HENDRA_EMP, role: 'BOD', email: 'h@x.id' } as any;
    const hasil = await approveKpi(db, sesi, kpiId);
    expect(hasil).toBeTruthy();
  });

  it('HR boleh menyetujui KPI pegawai lain', async () => {
    const kpiId = await buatKpi(BUDI_EMP, 'KPI Budi disetujui HR');
    const sesi = { userId: SITI_USER, employeeId: SITI_EMP, role: 'HR_MANAGER', email: 's@x.id' } as any;
    const hasil = await approveKpi(db, sesi, kpiId);
    expect(hasil).toBeTruthy();
  });
});
