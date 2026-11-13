import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { issueDisciplinary, listDisciplinary } from '@/lib/services/disciplinaryService';
import { hitungPoinPelanggaran, POIN_BAKU } from '@/lib/services/disciplinaryPoints';
import type { SessionPayload } from '@/lib/auth/session';

let client: PGlite;
let db: Db;
const BUDI = 'b0000000-0000-4000-8000-000000000004';
const SITI_USER = 'e0000000-0000-4000-8000-000000000002';
const SITI_EMP = 'b0000000-0000-4000-8000-000000000002';

const SESI_HR = () =>
  ({ userId: SITI_USER, employeeId: SITI_EMP, role: 'HR_MANAGER', email: 'hr@x.id' }) as SessionPayload;

beforeAll(async () => {
  ({ client } = await createTestDb());
  await runSeed(client);
  db = drizzle(client) as unknown as Db;
  await client.query('DELETE FROM disciplinary_actions WHERE employee_id = $1::uuid', [BUDI]);
}, 60000);

afterAll(async () => {
  await client.close();
});

/** Terbitkan sanksi lalu kembalikan baris tersimpannya. */
async function terbitkan(
  actionType: 'TEGURAN' | 'SP1' | 'SP2' | 'SP3',
  extra: { violationPoints?: number; violationCategory?: string; expiryDate?: string } = {}
) {
  return issueDisciplinary(db, {
    employeeId: BUDI,
    actionType,
    reason: 'Pelanggaran uji untuk poin.',
    effectiveDate: '2026-06-01',
    expiryDate: extra.expiryDate ?? '2027-06-01',
    issuedBy: SITI_USER,
    violationPoints: extra.violationPoints,
    violationCategory: extra.violationCategory,
  } as any);
}

describe('sanksi & pelanggaran — input oleh HR', () => {
  // Tiap tes berdiri sendiri: bersihkan sanksi Budi dari tes sebelumnya.
  beforeEach(async () => {
    await client.query('DELETE FROM disciplinary_actions WHERE employee_id = $1::uuid', [BUDI]);
  });

  it('HR dapat menerbitkan sanksi beserta POIN dan KATEGORI', async () => {
    const s: any = await terbitkan('SP1', { violationCategory: 'ABSENSI' });
    expect(s).toBeTruthy();

    const r = await client.query<{ violation_points: number; violation_category: string }>(
      'SELECT violation_points, violation_category FROM disciplinary_actions WHERE id = $1::uuid',
      [s.id]
    );
    // Poin kosong → diisi bobot baku SP1.
    expect(Number(r.rows[0].violation_points)).toBe(POIN_BAKU.SP1);
    expect(r.rows[0].violation_category).toBe('ABSENSI');
  });

  it('HR dapat menetapkan poin khusus (bukan baku)', async () => {
    const s: any = await terbitkan('TEGURAN', { violationPoints: 3 });
    const r = await client.query<{ violation_points: number }>(
      'SELECT violation_points FROM disciplinary_actions WHERE id = $1::uuid',
      [s.id]
    );
    expect(Number(r.rows[0].violation_points)).toBe(3);
  });

  it('pegawai melihat ringkasan poin pelanggaran dari sanksi yang masih berlaku', async () => {
    // Buat sendiri: SP1 (poin baku 5, kategori ABSENSI) + teguran berpoin 3.
    await terbitkan('SP1', { violationCategory: 'ABSENSI' });
    await terbitkan('TEGURAN', { violationPoints: 3 });

    const items = await listDisciplinary(db, BUDI);
    const ringkasan = hitungPoinPelanggaran(items as any[], { hariIni: new Date('2026-07-01') });
    // SP1 (5) + TEGURAN khusus (3) = 8 poin aktif.
    expect(ringkasan.totalPoinAktif).toBe(8);
    expect(ringkasan.perKategori.some((k) => k.kategori === 'ABSENSI')).toBe(true);
    // 8 poin melewati ambang 5 (perhatian atasan) tapi belum 10.
    expect(ringkasan.ambangTerlampaui?.poin).toBe(5);
  });

  it('sanksi yang sudah berakhir TIDAK dihitung ke poin aktif', async () => {
    await client.query('DELETE FROM disciplinary_actions WHERE employee_id = $1::uuid', [BUDI]);
    await terbitkan('SP2', { expiryDate: '2026-06-30' }); // sudah lewat pada 1 Juli
    const items = await listDisciplinary(db, BUDI);
    const ringkasan = hitungPoinPelanggaran(items as any[], { hariIni: new Date('2026-07-01') });
    expect(ringkasan.totalPoinAktif).toBe(0);
    expect(ringkasan.totalPoinKeseluruhan).toBe(POIN_BAKU.SP2);
  });

  it('pegawai tanpa sanksi berpoin 0', async () => {
    const items = await listDisciplinary(db, BUDI);
    const ringkasan = hitungPoinPelanggaran(items as any[], { hariIni: new Date('2020-01-01') });
    expect(ringkasan.totalPoinAktif).toBe(0);
    expect(ringkasan.ambangTerlampaui).toBeNull();
  });
});
