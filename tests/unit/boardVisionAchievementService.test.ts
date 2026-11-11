import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';
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
    // Seed kini berisi KPI untuk Budi, HR, dan People Manager. Agar angka capaian
    // pilar tetap terukur dan stabil, tes ini memakai data terkontrol: hanya KPI
    // milik Budi (yang memang dipakai untuk menghitung ekspektasi di bawah).
    await client.exec(
      `DELETE FROM individual_kpis
        WHERE employee_id <> 'b0000000-0000-4000-8000-000000000004'`
    );
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

  it('capaian keseluruhan memakai seluruh pilar sesuai spec §4', async () => {
    const result = await getVisionAchievement(db);
    expect(Number.isFinite(result.overallAchievementPercentage)).toBe(true);
      // Spec §4: "rata-rata tertimbang seluruh pilar". Pilar tanpa KPI bernilai 0%
      // pada bobotnya sendiri, sehingga:
      //   (92.5*25 + 102.5*25 + 83.3*25 + 0*25) / 100 = 69.6
      expect(result.overallAchievementPercentage).toBe(69.6);
    });

    it('melaporkan cakupan pengukuran berbobot terpisah dari capaian', async () => {
      const result = await getVisionAchievement(db);

      // 3 dari 4 pilar (bobot 25% masing-masing) punya KPI -> cakupan 75%.
      expect(result.measurementCoveragePercentage).toBe(75);
      expect(result.measuredWeight).toBe(75);
      expect(result.totalWeight).toBe(100);

      // Capaian pada bagian yang benar-benar dinilai, sebagai konteks — BUKAN
      // angka resmi. Angka resmi tetap overallAchievementPercentage (69.6).
      expect(result.measuredAchievementPercentage).toBe(92.8);
      expect(result.overallAchievementPercentage).toBe(69.6);

      // Cakupan + capaian tidak boleh tertukar: bila keduanya sama, laporan
      // kehilangan makna karena pembaca tidak bisa memisahkan "gagal" dari
      // "belum diukur".
      expect(result.measurementCoveragePercentage).not.toBe(
        result.overallAchievementPercentage
      );
    });

    it('menyebut pilar belum dinilai secara eksplisit, bukan sebagai kegagalan', async () => {
      const result = await getVisionAchievement(db);
      const customer = result.pillars.find((p) => p.perspective === 'CUSTOMER');

      // Status tetap NO_DATA (kontrak API), tetapi UI/pembaca harus mendapat
      // kalimat yang membedakannya dari "di bawah target".
      expect(customer?.status).toBe('NO_DATA');
      expect(customer?.measured).toBe(false);

      const measured = result.pillars.find((p) => p.perspective === 'FINANCIAL');
      expect(measured?.measured).toBe(true);

      const highlight = result.analysis.highlights.join(' ');
      expect(highlight).toContain('75%');
      expect(highlight).toMatch(/belum dinilai|belum memiliki KPI/i);
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

  it('mendaftar corporate KPI yang belum punya KPI individual (register cascade)', async () => {
    const result = await getVisionAchievement(db);

    // Seed: keempat corporate KPI belum diturunkan ke KPI individual mana pun.
    expect(result.cascadeGaps.map((g) => g.kpiCode).sort()).toEqual([
      'CORP-CUS-01',
      'CORP-FIN-01',
      'CORP-INT-01',
      'CORP-LRN-01',
    ]);

    const cus = result.cascadeGaps.find((g) => g.kpiCode === 'CORP-CUS-01');
    expect(cus?.pillarPerspective).toBe('CUSTOMER');
    expect(cus?.templateCount).toBeGreaterThan(0);
    expect(cus?.coveredTemplateCount).toBe(0);
    // Register harus menuduh pekerjaan yang bisa ditugaskan, bukan sekadar gejala.
    expect(cus?.positionsMissingKpi.length).toBeGreaterThan(0);
    expect(cus?.positionsMissingKpi.join(' ')).toMatch(/Chief Executive/);
  });

  it('menutup gap setelah KPI individual yang cocok ditetapkan', async () => {
    const iso = await createTestDb();
    try {
      await runSeed(iso.client);
      const isoDb = drizzle(iso.client) as unknown as Db;
      const pillar = await isoDb.execute(
        sql`SELECT id FROM strategic_pillars WHERE perspective = 'CUSTOMER' LIMIT 1`
      );
      const customerPillar = String((pillar.rows[0] as { id: string }).id);

      // Tindakan HR: tetapkan KPI pemilik template CEO pada pilar pelanggan.
      await isoDb.execute(sql`
        INSERT INTO individual_kpis
          (period_id, employee_id, strategic_pillar_id, kpi_title, target_value, actual_value, kpi_weight)
        VALUES ('d0000000-0000-4000-8000-000000000001'::uuid,
                'b0000000-0000-4000-8000-000000000001'::uuid,
                ${customerPillar}::uuid, 'Indeks Kepuasan Stakeholder', 90, 94, 30)
      `);

      const after = await getVisionAchievement(isoDb, '2026-Q3');
      expect(after.cascadeGaps.some((g) => g.kpiCode === 'CORP-CUS-01')).toBe(false);
      expect(after.measurementCoveragePercentage).toBe(100);
      expect(after.pillars.find((p) => p.perspective === 'CUSTOMER')?.measured).toBe(true);
    } finally {
      await iso.client.close();
    }
  });

  it('satu periode tanpa KPI belum menjadi temuan tata kelola', async () => {
    const result = await getVisionAchievement(db);
    expect(result.analysis.previousPeriodCode).toBeNull();
    expect(result.analysis.governanceFindings).toEqual([]);
  });

  it('menandai pilar tanpa KPI dua periode berturut-turut sebagai temuan', async () => {
    const iso = await createTestDb();
    try {
      await runSeed(iso.client);
      const isoDb = drizzle(iso.client) as unknown as Db;
      const pillar = await isoDb.execute(
        sql`SELECT id FROM strategic_pillars WHERE perspective = 'FINANCIAL' LIMIT 1`
      );
      const financialPillar = String((pillar.rows[0] as { id: string }).id);

      // Seed mengisi keempat pilar pada Q3 (CUSTOMER termasuk, lewat KPI HR dan
      // People Manager). Untuk menguji temuan "belum diukur dua periode",
      // kosongkan CUSTOMER pada Q3 agar kedua periode benar-benar tanpa KPI.
      await isoDb.execute(sql`
        DELETE FROM individual_kpis
         WHERE strategic_pillar_id IN (
           SELECT id FROM strategic_pillars WHERE perspective = 'CUSTOMER'
         )
      `);

      // Periode sebelumnya (Q2) hanya punya KPI pada FINANCIAL.
      await isoDb.execute(sql`
        INSERT INTO appraisal_periods (id, period_code, start_date, end_date, status)
        VALUES ('d0000000-0000-4000-8000-000000000009'::uuid, '2026-Q2',
                '2026-04-01', '2026-06-30', 'LOCKED')
      `);
      await isoDb.execute(sql`
        INSERT INTO individual_kpis
          (period_id, employee_id, strategic_pillar_id, kpi_title, target_value, actual_value, kpi_weight)
        VALUES ('d0000000-0000-4000-8000-000000000009'::uuid,
                'b0000000-0000-4000-8000-000000000004'::uuid,
                ${financialPillar}::uuid, 'KPI Finansial Kuartal Dua', 100, 90, 40)
      `);

      const result = await getVisionAchievement(isoDb, '2026-Q3');
      expect(result.analysis.previousPeriodCode).toBe('2026-Q2');

      const finding = result.analysis.governanceFindings.find((f) =>
        f.pillarName.includes('Kepuasan')
      );
      expect(finding?.code).toBe('UNMEASURED_CONSECUTIVE_PERIODS');
      expect(finding?.severity).toBe('GOVERNANCE');
      expect(finding?.periods).toEqual(['2026-Q2', '2026-Q3']);

      // FINANCIAL punya KPI di Q2, jadi tidak boleh ikut ditandai.
      expect(
        result.analysis.governanceFindings.some((f) => f.pillarName.includes('Pendapatan'))
      ).toBe(false);

      // Temuan wajib muncul di highlight agar masuk risalah BOD.
      expect(result.analysis.highlights.join(' ')).toMatch(/temuan tata kelola/i);
    } finally {
      await iso.client.close();
    }
  });

  it('menyatakan visi belum ditetapkan bila tabel kosong, tanpa mengarang teks', async () => {
      // DB terisolasi: test ini menghapus company_vision_mission sehingga tidak
      // boleh merusak test lain (dulu hanya lulus bila dijalankan lebih dulu).
      const iso = await createTestDb();
      try {
        await runSeed(iso.client);
        const isoDb = drizzle(iso.client) as unknown as Db;
        await iso.client.exec('DELETE FROM company_vision_mission');

        const result = await getVisionAchievement(isoDb);
        expect(result.vision).toBeNull();
        expect(result.missions).toEqual([]);
      } finally {
        await iso.client.close();
      }
    });

  it('hanya mengagregasi KPI periode yang diminta', async () => {
    // KPI Q4 pada pilar FINANCIAL tidak boleh mengubah capaian Q3.
    const pillar = await db.execute(
      sql`SELECT id FROM strategic_pillars WHERE perspective = 'FINANCIAL' LIMIT 1`
    );
    const pillarId = String((pillar.rows[0] as { id: string }).id);

    await db.execute(sql`
      INSERT INTO individual_kpis
        (period_id, employee_id, strategic_pillar_id, kpi_title, target_value, actual_value, kpi_weight)
      VALUES ('d0000000-0000-4000-8000-000000000002'::uuid,
              'b0000000-0000-4000-8000-000000000004'::uuid,
              ${pillarId}::uuid, 'KPI Kuartal Empat', 100, 10, 50)
    `);

    const q3 = await getVisionAchievement(db, '2026-Q3');
    const finQ3 = q3.pillars.find((p) => p.perspective === 'FINANCIAL');
    expect(finQ3?.achievementPercentage).toBe(92.5);
    expect(q3.sampleSize).toBe(4);

    const q4 = await getVisionAchievement(db, '2026-Q4');
    const finQ4 = q4.pillars.find((p) => p.perspective === 'FINANCIAL');
    expect(finQ4?.achievementPercentage).toBe(10);
    expect(q4.sampleSize).toBe(1);
  });
});
