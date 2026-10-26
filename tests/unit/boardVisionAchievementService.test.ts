import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { getVisionAchievement } from '@/lib/services/boardVisionAchievementService';

describe('Vision Achievement (Visi-Misi & RJMP)', () => {
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

  it('membaca visi dan memecah misi dari pemisah pipa', async () => {
    const result = await getVisionAchievement(db);
    expect(result.vision).toContain('kelas dunia');
    expect(result.missions).toHaveLength(3);
    expect(result.missions[0]).toContain('ekosistem penilaian kinerja');
  });

  it('menghitung capaian pilar secara tertimbang', async () => {
    const result = await getVisionAchievement(db);

    const financial = result.pillars.find((p) => p.perspective === 'FINANCIAL');
    expect(financial?.achievementPercentage).toBe(92.5);
    expect(financial?.status).toBe('BELOW_TARGET');

    const internal = result.pillars.find((p) => p.perspective === 'INTERNAL_PROCESS');
    expect(internal?.achievementPercentage).toBe(102.5);
    expect(internal?.status).toBe('ACHIEVED');

    const learning = result.pillars.find((p) => p.perspective === 'LEARNING_GROWTH');
    expect(learning?.achievementPercentage).toBe(83.3);
  });

  it('pilar tanpa KPI menjadi NO_DATA dengan 0%, bukan NaN', async () => {
    const result = await getVisionAchievement(db);
    const customer = result.pillars.find((p) => p.perspective === 'CUSTOMER');
    expect(customer?.kpiCount).toBe(0);
    expect(customer?.achievementPercentage).toBe(0);
    expect(customer?.status).toBe('NO_DATA');
  });

  it('capaian keseluruhan hanya memakai pilar yang punya data', async () => {
    const result = await getVisionAchievement(db);
    expect(Number.isFinite(result.overallAchievementPercentage)).toBe(true);
    // (92.5 + 102.5 + 83.3) / 3 ≈ 92.8 — pilar tanpa data tidak dihitung sebagai 0.
    expect(result.overallAchievementPercentage).toBeGreaterThan(92);
    expect(result.overallAchievementPercentage).toBeLessThan(94);
  });

  it('menurunkan capaian RJMP dari pilar terkait', async () => {
    const result = await getVisionAchievement(db);
    expect(result.rjmp).toHaveLength(4);

    const fin = result.rjmp.find((r) => r.kpiCode === 'CORP-FIN-01');
    expect(fin?.derivedAchievementPercentage).toBe(92.5);
    expect(fin?.status).toBe('BELOW_TARGET');

    const cus = result.rjmp.find((r) => r.kpiCode === 'CORP-CUS-01');
    expect(cus?.derivedAchievementPercentage).toBe(0);
    expect(cus?.status).toBe('NO_DATA');
  });

  it('menyusun analisis: pilar terkuat, terlemah, dan jumlah tercapai', async () => {
    const result = await getVisionAchievement(db);
    expect(result.analysis.achievedPillarCount).toBe(1);
    expect(result.analysis.belowTargetPillarCount).toBe(2);
    expect(result.analysis.strongestPillar).toContain('Keunggulan Operasional');
    expect(result.analysis.weakestPillar).toContain('Kapabilitas Human Capital');
    expect(result.analysis.highlights.length).toBeGreaterThan(0);
  });

  it('menyatakan visi belum ditetapkan bila tabel kosong, tanpa mengarang teks', async () => {
    await client.exec('DELETE FROM company_vision_mission');
    const result = await getVisionAchievement(db);
    expect(result.vision).toBeNull();
    expect(result.missions).toEqual([]);
  });
});
