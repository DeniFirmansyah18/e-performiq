import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import {
  ajukanMpp,
  putuskanMpp,
  daftarMppMenunggu,
  MppButuhAtasanError,
  MppBukanPengajuError,
} from '@/lib/services/mppApprovalService';

let client: PGlite;
let db: Db;

// Seed: departemen IT, People Manager Danu, HR Siti, BOD Hendra.
const DEPT_IT = 'a0000000-0000-4000-8000-000000000101';
const POS_IT = 'a0000000-0000-4000-8000-000000000204';
const DANU = 'b0000000-0000-4000-8000-000000000003';
const HR_USER = 'e0000000-0000-4000-8000-000000000002';
const BOD_USER = 'e0000000-0000-4000-8000-000000000001';

const usul = {
  departmentId: DEPT_IT,
  positionId: POS_IT,
  fiscalYear: 2027,
  approvedQuota: 4,
  allocatedBudget: 240000000,
};

beforeAll(async () => {
  ({ client } = await createTestDb());
  await runSeed(client);
  db = drizzle(client) as unknown as Db;
}, 60000);

afterAll(async () => {
  await client.close();
});

async function statusMpp(id: string): Promise<string> {
  const r = await client.query<{ status: string }>(
    'SELECT status::text AS status FROM manpower_plans WHERE id = $1::uuid',
    [id]
  );
  return r.rows[0].status;
}

describe('alur persetujuan MPP: HR mengajukan, BOD memutuskan', () => {
  it('MPP lama tetap APPROVED agar rekrutmen berjalan tidak terblokir', async () => {
    const r = await client.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM manpower_plans WHERE status = 'APPROVED'"
    );
    expect(r.rows[0].n).toBeGreaterThan(0);
  });

  it('pengajuan HR masuk antrean PENDING dan mencatat pengaju', async () => {
    const mpp = await ajukanMpp(db, { ...usul, managerId: DANU, userId: HR_USER });
    expect(mpp.status).toBe('PENDING');
    expect(mpp.managerId).toBe(DANU);
    expect(await statusMpp(mpp.id)).toBe('PENDING');

    const menunggu = await daftarMppMenunggu(db);
    expect(menunggu.some((m) => m.id === mpp.id)).toBe(true);
  });

  it('wajib memilih atasan langsung (People Manager)', async () => {
    await expect(
      ajukanMpp(db, { ...usul, fiscalYear: 2028, managerId: null as any, userId: HR_USER })
    ).rejects.toBeInstanceOf(MppButuhAtasanError);
  });

  it('atasan yang dipilih harus People Manager yang aktif', async () => {
    // Karyawan biasa (Budi) bukan People Manager.
    await expect(
      ajukanMpp(db, {
        ...usul,
        fiscalYear: 2029,
        managerId: 'b0000000-0000-4000-8000-000000000004',
        userId: HR_USER,
      })
    ).rejects.toBeInstanceOf(MppButuhAtasanError);
  });

  it('BOD menyetujui -> status APPROVED dan tercatat pemutusnya', async () => {
    const mpp = await ajukanMpp(db, { ...usul, fiscalYear: 2030, managerId: DANU, userId: HR_USER });
    const hasil = await putuskanMpp(db, {
      id: mpp.id,
      keputusan: 'APPROVED',
      userId: BOD_USER,
      catatan: 'Sesuai rencana ekspansi.',
    });
    expect(hasil.status).toBe('APPROVED');

    const r = await client.query<{ decided_by: string | null; decision_note: string | null }>(
      'SELECT decided_by::text AS decided_by, decision_note FROM manpower_plans WHERE id = $1::uuid',
      [mpp.id]
    );
    expect(r.rows[0].decided_by).toBe(BOD_USER);
    expect(r.rows[0].decision_note).toContain('ekspansi');
  });

  it('BOD menolak -> status REJECTED beserta alasan', async () => {
    const mpp = await ajukanMpp(db, { ...usul, fiscalYear: 2031, managerId: DANU, userId: HR_USER });
    const hasil = await putuskanMpp(db, {
      id: mpp.id,
      keputusan: 'REJECTED',
      userId: BOD_USER,
      catatan: 'Anggaran belum tersedia tahun ini.',
    });
    expect(hasil.status).toBe('REJECTED');

    const r = await client.query<{ decision_note: string | null }>(
      'SELECT decision_note FROM manpower_plans WHERE id = $1::uuid',
      [mpp.id]
    );
    expect(r.rows[0].decision_note).toContain('Anggaran');
  });

  it('penolakan wajib menyertakan alasan', async () => {
    const mpp = await ajukanMpp(db, { ...usul, fiscalYear: 2032, managerId: DANU, userId: HR_USER });
    await expect(
      putuskanMpp(db, { id: mpp.id, keputusan: 'REJECTED', userId: BOD_USER })
    ).rejects.toBeInstanceOf(MppBukanPengajuError);
  });

  it('MPP yang sudah diputuskan tidak bisa diputuskan ulang', async () => {
    const mpp = await ajukanMpp(db, { ...usul, fiscalYear: 2033, managerId: DANU, userId: HR_USER });
    await putuskanMpp(db, { id: mpp.id, keputusan: 'APPROVED', userId: BOD_USER });
    await expect(
      putuskanMpp(db, { id: mpp.id, keputusan: 'REJECTED', userId: BOD_USER, catatan: 'ulang' })
    ).rejects.toThrow(/sudah diputuskan/i);
  });
});
