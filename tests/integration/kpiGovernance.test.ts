import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import {
  submitIndividualKpi,
  approveIndividualKpi,
  rejectIndividualKpi,
  periksaKelengkapanKpi,
  MIN_INDIKATOR,
  MAX_INDIKATOR,
  listIndividualKpis,
} from '@/lib/services/kpiService';
import type { SessionPayload } from '@/lib/auth/session';

let client: PGlite;
let db: Db;
let periodId = '';
let pillarId = '';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const DANU = 'b0000000-0000-4000-8000-000000000003';

/** Sesi pegawai (Budi) dan atasan (Danu, People Manager). */
function sesi(employeeId: string, userId: string, role: any): SessionPayload {
  return { userId, employeeId, role, email: 'x@x.id' } as SessionPayload;
}
const SESI_BUDI = () => sesi(BUDI, 'e0000000-0000-4000-8000-000000000004', 'EMPLOYEE');
const SESI_DANU = () => sesi(DANU, 'e0000000-0000-4000-8000-000000000003', 'PEOPLE_MANAGER');

beforeAll(async () => {
  ({ client } = await createTestDb());
  await runSeed(client);
  db = drizzle(client) as unknown as Db;
  const p = await client.query<{ id: string }>('SELECT id::text AS id FROM appraisal_periods ORDER BY start_date DESC LIMIT 1');
  periodId = p.rows[0].id;
  const pil = await client.query<{ id: string }>('SELECT id::text AS id FROM strategic_pillars LIMIT 1');
  pillarId = pil.rows[0].id;
  // Bersihkan KPI Budi agar tes deterministik.
  await client.query('DELETE FROM individual_kpis WHERE employee_id = $1::uuid', [BUDI]);
}, 60000);

afterAll(async () => {
  await client.close();
});

/** Buat KPI Budi dengan bobot & jumlah indikator tertentu. */
async function buatKpi(judul: string, bobot: number) {
  return submitIndividualKpi(db, SESI_BUDI(), {
    periodId,
    employeeId: BUDI,
    strategicPillarId: pillarId,
    kpiTitle: judul,
    targetValue: 100,
    kpiWeight: bobot,
    unitOfMeasure: '%',
  } as any);
}

/** Bersihkan seluruh KPI & indikator Budi agar tiap tes berdiri sendiri. */
async function bersihkanKpi() {
  // Indikator terhapus otomatis lewat ON DELETE CASCADE saat KPI dihapus.
  await client.query('DELETE FROM individual_kpis WHERE employee_id = $1::uuid', [BUDI]);
}

/** Sebelum tiap tes: KPI kosong. */
beforeEach(async () => {
  await bersihkanKpi();
});

/** Tambahkan `n` indikator aktif pada sebuah KPI (bobot dibagi rata). */
async function tambahIndikator(kpiId: string, n: number) {
  const { createIndicator } = await import('@/lib/services/kpiIndicatorService');
  const bobot = Math.floor(100 / n);
  for (let i = 1; i <= n; i++) {
    await createIndicator(db, SESI_BUDI(), {
      kpiId,
      indicatorName: `Indikator ${i}`,
      unitOfMeasure: '%',
      targetValue: 100,
      direction: 'HIGHER_BETTER',
      frequency: 'DAILY',
      aggregation: 'AVG',
      indicatorWeight: bobot,
    } as any);
  }
}

describe('KPI — pengaman 1: persetujuan atasan sebelum berlaku', () => {
  it('KPI yang diajukan berstatus SUBMITTED, belum berlaku', async () => {
    const kpi = await buatKpi('KPI Uji Persetujuan', 100);
    expect(kpi.status).toBe('SUBMITTED');
    expect(kpi.approvedAt ?? null).toBeNull();
  });

  it('atasan dapat menyetujui, lalu status menjadi APPROVED + tercatat penyetuju', async () => {
    const kpi = await buatKpi('KPI Uji Setuju', 100);
    await tambahIndikator(kpi.id, 3);
    const hasil = await approveIndividualKpi(db, SESI_DANU(), kpi.id);
    expect(hasil.status).toBe('APPROVED');

    const r = await client.query<{ status: string; approved_by: string | null; approved_at: string | null }>(
      'SELECT status::text AS status, approved_by::text AS approved_by, approved_at::text AS approved_at FROM individual_kpis WHERE id = $1::uuid',
      [kpi.id]
    );
    expect(r.rows[0].status).toBe('APPROVED');
    expect(r.rows[0].approved_by).toBeTruthy();
    expect(r.rows[0].approved_at).toBeTruthy();
  });

  it('atasan dapat menolak dengan alasan', async () => {
    const kpi = await buatKpi('KPI Uji Tolak', 100);
    const hasil = await rejectIndividualKpi(db, SESI_DANU(), kpi.id, 'Target tidak realistis.');
    expect(hasil.status).toBe('REJECTED');
  });

  it('pegawai TIDAK boleh menyetujui KPI-nya sendiri', async () => {
    const kpi = await buatKpi('KPI Uji Sendiri', 100);
    await expect(approveIndividualKpi(db, SESI_BUDI(), kpi.id)).rejects.toThrow(/atasan|wewenang|tidak berhak|approve/i);
  });

  it('KPI yang sudah disetujui tidak dapat disetujui ulang', async () => {
    const kpi = await buatKpi('KPI Uji Ganda', 100);
    await tambahIndikator(kpi.id, 3);
    await approveIndividualKpi(db, SESI_DANU(), kpi.id);
    await expect(approveIndividualKpi(db, SESI_DANU(), kpi.id)).rejects.toThrow(/sudah|APPROVED/i);
  });
});

describe('KPI — pengaman 2: total bobot wajib 100%', () => {
  it('pemeriksaan kelengkapan menandai total bobot belum 100%', async () => {
    await client.query('DELETE FROM individual_kpis WHERE employee_id = $1::uuid', [BUDI]);
    await buatKpi('KPI Bobot 60', 60);
    const cek = await periksaKelengkapanKpi(db, BUDI, periodId);
    expect(cek.totalBobot).toBe(60);
    expect(cek.bobotPas).toBe(false);
    expect(cek.pesanBobot).toMatch(/100%/);
  });

  it('atasan menolak menyetujui bila total bobot belum 100%', async () => {
    await client.query('DELETE FROM individual_kpis WHERE employee_id = $1::uuid', [BUDI]);
    const kpi = await buatKpi('KPI Bobot 60 Saja', 60);
    await expect(approveIndividualKpi(db, SESI_DANU(), kpi.id)).rejects.toThrow(/100%/);
  });

  it('total bobot 100% dianggap pas', async () => {
    await client.query('DELETE FROM individual_kpis WHERE employee_id = $1::uuid', [BUDI]);
    await buatKpi('KPI A', 60);
    await buatKpi('KPI B', 40);
    const cek = await periksaKelengkapanKpi(db, BUDI, periodId);
    expect(cek.totalBobot).toBe(100);
    expect(cek.bobotPas).toBe(true);
  });
});

describe('KPI — pengaman 3: batas 3–5 indikator', () => {
  it('menetapkan batas MIN & MAX', () => {
    expect(MIN_INDIKATOR).toBe(3);
    expect(MAX_INDIKATOR).toBe(5);
  });

  it('pemeriksaan menandai KPI tanpa indikator sebagai belum lengkap', async () => {
    await client.query('DELETE FROM individual_kpis WHERE employee_id = $1::uuid', [BUDI]);
    await buatKpi('KPI Tanpa Indikator', 100);
    const cek = await periksaKelengkapanKpi(db, BUDI, periodId);
    expect(cek.jumlahIndikator).toBe(0);
    expect(cek.indikatorCukup).toBe(false);
    expect(cek.pesanIndikator).toMatch(/3/);
  });

  it('KPI dengan 3 indikator dinyatakan cukup', async () => {
    await client.query('DELETE FROM individual_kpis WHERE employee_id = $1::uuid', [BUDI]);

    const kpi = await buatKpi('KPI Dengan Indikator', 100);
    const { createIndicator } = await import('@/lib/services/kpiIndicatorService');
    for (let i = 1; i <= 3; i++) {
      await createIndicator(db, SESI_BUDI(), {
        kpiId: kpi.id,
        indicatorName: `Indikator ${i}`,
        unitOfMeasure: '%',
        targetValue: 100,
        direction: 'HIGHER_BETTER',
        frequency: 'DAILY',
        aggregation: 'AVG',
        indicatorWeight: 30,
      } as any);
    }
    const cek = await periksaKelengkapanKpi(db, BUDI, periodId);
    expect(cek.jumlahIndikator).toBeGreaterThanOrEqual(3);
    expect(cek.indikatorCukup).toBe(true);
  });

  it('menolak indikator ke-6 (maksimal 5)', async () => {
    await client.query('DELETE FROM individual_kpis WHERE employee_id = $1::uuid', [BUDI]);
    const kpi = await buatKpi('KPI Banyak Indikator', 100);
    const { createIndicator } = await import('@/lib/services/kpiIndicatorService');

    let kelebihanTertolak = false;
    for (let i = 1; i <= 6; i++) {
      try {
        await createIndicator(db, SESI_BUDI(), {
          kpiId: kpi.id,
          indicatorName: `Indikator ${i}`,
          unitOfMeasure: '%',
          targetValue: 100,
          direction: 'HIGHER_BETTER',
          frequency: 'DAILY',
          aggregation: 'AVG',
          indicatorWeight: 15,
        } as any);
      } catch (e: any) {
        kelebihanTertolak = /maksimal|5 indikator|batas/i.test(String(e?.message ?? ''));
        break;
      }
    }
    expect(kelebihanTertolak, 'indikator ke-6 harus ditolak').toBe(true);
  });
});

describe('KPI — keselarasan dengan visi & misi perusahaan', () => {
  it('KPI wajib terhubung ke Pilar Strategis (cascading BSC)', async () => {
    await client.query('DELETE FROM individual_kpis WHERE employee_id = $1::uuid', [BUDI]);
    await expect(
      submitIndividualKpi(db, SESI_BUDI(), {
        periodId,
        employeeId: BUDI,
        strategicPillarId: null as any,
        kpiTitle: 'KPI Tanpa Pilar',
        targetValue: 100,
        kpiWeight: 100,
        unitOfMeasure: '%',
      } as any)
    ).rejects.toThrow(/Pilar Strategis/i);
  });

  it('daftar KPI memuat status persetujuan agar pegawai tahu mana yang berlaku', async () => {
    await client.query('DELETE FROM individual_kpis WHERE employee_id = $1::uuid', [BUDI]);
    const kpi = await buatKpi('KPI Status Terlihat', 100);
    const daftar = await listIndividualKpis(db, SESI_BUDI(), BUDI, periodId);
    const item = daftar.find((k: any) => k.id === kpi.id);
    expect(item).toBeTruthy();
    expect((item as any).status).toBe('SUBMITTED');
  });
});
