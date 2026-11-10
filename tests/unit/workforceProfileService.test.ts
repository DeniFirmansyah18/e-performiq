import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { getWorkforceProfile } from '@/lib/services/workforceProfileService';
import { sql } from 'drizzle-orm';

describe('Workforce Profile - Manajemen Kepegawaian (Narasi 3 pilar 3)', () => {
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

  it('menghitung headcount dari data karyawan nyata', async () => {
    const profile = await getWorkforceProfile(db);
    expect(profile.headcount.total).toBeGreaterThan(0);
    // Seed berisi karyawan RESIGNED, jadi aktif < total.
    expect(profile.headcount.active).toBeLessThan(profile.headcount.total);
  });

  it('sebaran departemen berjumlah sama dengan karyawan aktif', async () => {
    const profile = await getWorkforceProfile(db);
    const sum = profile.byDepartment.reduce((s, b) => s + b.count, 0);
    expect(sum).toBe(profile.headcount.active);
  });

  it('persentase tiap sebaran berjumlah mendekati 100%', async () => {
    const profile = await getWorkforceProfile(db);
    const sum = profile.byGender.reduce((s, b) => s + b.percentage, 0);
    expect(sum).toBeGreaterThan(99);
    expect(sum).toBeLessThan(101);
  });

  it('pita usia selalu memuat label Tidak diketahui bila tanggal lahir kosong', async () => {
    const profile = await getWorkforceProfile(db);
    const labels = profile.byAgeBand.map((b) => b.label);
    expect(labels).toContain('Tidak diketahui');
  });

  it('capaian KPI dihitung dari individual_kpis', async () => {
    const profile = await getWorkforceProfile(db);
    // Inti tes: angka diambil dari tabel KPI, bukan konstanta. Jumlah baris
    // sengaja tidak dipatok karena seed memuat KPI departemen juga.
    const res = await client.query<{ n: string }>('SELECT count(*)::text AS n FROM individual_kpis');
    expect(profile.kpiAchievement.totalKpi).toBe(Number(res.rows[0].n));
    expect(profile.kpiAchievement.totalKpi).toBeGreaterThan(0);
    expect(profile.kpiAchievement.averagePercentage).toBeGreaterThan(0);
  });

  it('pemenuhan MPP dihitung dari manpower_plans tanpa pembagian nol', async () => {
    const profile = await getWorkforceProfile(db);
    expect(profile.mppFulfillment.quota).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(profile.mppFulfillment.percentage)).toBe(true);
    expect(profile.mppFulfillment.percentage).toBeGreaterThanOrEqual(0);
  });

  it('distribusi rating berasal dari performance_appraisals, bukan angka contoh', async () => {
    const profile = await getWorkforceProfile(db);
    // Seed berisi 7 appraisal (satu per karyawan): 4 rating A dan 3 rating B.
    expect(profile.ratingDistribution).toEqual([
      { rating: 'A', count: 4, percentage: 57.1 },
      { rating: 'B', count: 3, percentage: 42.9 },
    ]);
  });

  it('distribusi rating mengabaikan appraisal lama (ambil terbaru per karyawan)', async () => {
    const BUDI = 'b0000000-0000-4000-8000-000000000004';
    // Appraisal periode berikutnya dengan rating B; harus menggantikan rating A.
    await db.execute(sql`
      INSERT INTO performance_appraisals
        (period_id, employee_id, kpi_composite_score, sop_compliance_score, competency_score,
         core_values_score, total_percentage_score, composite_gpa, performance_rating,
         potential_score, nine_box_quadrant, created_at)
      VALUES ('d0000000-0000-4000-8000-000000000002'::uuid, ${BUDI}::uuid,
              85, 85, 85, 85, 85, 3.40, 'B', 3.50, 'CORE_PLAYER', NOW() + INTERVAL '1 day')
    `);

    const profile = await getWorkforceProfile(db);
    // Rating A milik Budi berganti ke B: A tinggal 3, B menjadi 4.
    expect(profile.ratingDistribution).toEqual([
      { rating: 'A', count: 3, percentage: 42.9 },
      { rating: 'B', count: 4, percentage: 57.1 },
    ]);
  });
});