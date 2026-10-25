import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { getWorkforceProfile } from '@/lib/services/workforceProfileService';

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
    expect(profile.kpiAchievement.totalKpi).toBe(4);
    expect(profile.kpiAchievement.averagePercentage).toBeGreaterThan(0);
  });

  it('pemenuhan MPP dihitung dari manpower_plans tanpa pembagian nol', async () => {
    const profile = await getWorkforceProfile(db);
    expect(profile.mppFulfillment.quota).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(profile.mppFulfillment.percentage)).toBe(true);
    expect(profile.mppFulfillment.percentage).toBeGreaterThanOrEqual(0);
  });
});