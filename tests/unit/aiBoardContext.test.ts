import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { buildFeatureContext } from '@/lib/services/aiContext';

const FORBIDDEN_KEYS = [
  'baseSalary', 'fixedAllowance', 'overtimePay', 'pph21',
  'gross', 'net', 'totalDeductions', 'bpjsKesehatan', 'bpjsJht', 'bpjsJp',
  'bpjsTkNumber', 'bpjsKesNumber', 'bpjsTkNumberMasked', 'bpjsKesNumberMasked',
];

describe('Konteks AI Boardroom', () => {
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

  it('merakit konteks board dari visi, pilar, RJMP, posisi, dan aktivitas', async () => {
    const ctx: any = await buildFeatureContext(db, 'board');
    expect(ctx.feature).toBe('board');
    expect(ctx.vision).toContain('kelas dunia');
    expect(ctx.missions).toHaveLength(3);
    expect(ctx.pillars).toHaveLength(4);
    expect(ctx.rjmp).toHaveLength(4);
    expect(ctx.positionFit.sampleSize).toBeGreaterThan(0);
    expect(ctx.activity.totalEvents).toBeGreaterThan(0);
  });

  it('tidak memuat satu pun kunci payroll atau BPJS', async () => {
    const ctx: any = await buildFeatureContext(db, 'board');
    const flat = JSON.stringify(ctx);

    for (const key of FORBIDDEN_KEYS) {
      expect(flat).not.toContain(`"${key}"`);
    }
    // Nomor BPJS seed berjumlah 16 digit; tidak boleh ada di konteks.
    expect(flat).not.toMatch(/\d{16}/);
  });

  it('tidak memuat data RESTRICTED aktivitas', async () => {
    const ctx: any = await buildFeatureContext(db, 'board');
    expect(JSON.stringify(ctx)).not.toContain('rahasia');
  });

  it('tetap aman bila data kosong', async () => {
      // DB terisolasi: test ini mengosongkan individual_kpis sehingga tidak boleh
      // mengubah hasil test lain dalam berkas yang sama.
      const iso = await createTestDb();
      try {
        await runSeed(iso.client);
        const isoDb = drizzle(iso.client) as unknown as Db;
        await iso.client.exec('DELETE FROM individual_kpis');

        const ctx: any = await buildFeatureContext(isoDb, 'board');
        expect(ctx.pillars).toHaveLength(4);
        expect(ctx.overallAchievement).toBe(0);
        expect(JSON.stringify(ctx)).not.toContain('NaN');
      } finally {
        await iso.client.close();
      }
    });
});
