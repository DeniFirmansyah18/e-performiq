import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { getBoardActivityAnalytics } from '@/lib/services/boardActivityAnalyticsService';

const RANGE = { fromDate: '2026-09-19', toDate: '2026-09-24' };

describe('Board Activity Analytics', () => {
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

  it('mengagregasi event per tipe dan menghitung persentase', async () => {
    const result = await getBoardActivityAnalytics(db, RANGE);
    expect(result.totalEvents).toBeGreaterThan(0);
    expect(result.byEventType.length).toBeGreaterThan(0);

    const sumPct = result.byEventType.reduce((s, b) => s + b.percentage, 0);
    expect(sumPct).toBeGreaterThan(99);
    expect(sumPct).toBeLessThan(101);
  });

  it('mengecualikan event RESTRICTED dari seluruh keluaran', async () => {
    const result = await getBoardActivityAnalytics(db, RANGE);
    const summaries = result.recent.map((r) => r.summary);
    expect(summaries.some((s) => s.includes('rahasia'))).toBe(false);

    // Event RESTRICTED seed bertipe DISCIPLINARY; tipe itu tidak boleh muncul.
    expect(result.byEventType.some((b) => b.eventType === 'DISCIPLINARY')).toBe(false);
  });

  it('mengelompokkan aktivitas menurut peran pemilik', async () => {
    const result = await getBoardActivityAnalytics(db, RANGE);
    expect(result.byOwnerRole.length).toBeGreaterThan(1);
    const roles = result.byOwnerRole.map((r) => r.role);
    expect(roles).toContain('EMPLOYEE');
    expect(roles).toContain('PEOPLE_MANAGER');
  });

  it('melengkapi hari tanpa event pada tren harian', async () => {
    const result = await getBoardActivityAnalytics(db, RANGE);
    expect(result.dailyTrend).toHaveLength(6); // 19..24 September inklusif
    // 19 September hanya berisi satu event RESTRICTED, sehingga tersaring habis.
    expect(result.dailyTrend.find((d) => d.date === '2026-09-19')?.count).toBe(0);
    expect(result.dailyTrend.filter((d) => d.count === 0)).toHaveLength(1);
  });

  it('total event sama dengan jumlah event non-RESTRICTED pada rentang', async () => {
    const result = await getBoardActivityAnalytics(db, RANGE);
    // Seed: 12 event, 1 di antaranya RESTRICTED (19 Sep) -> 11 tersisa.
    expect(result.totalEvents).toBe(11);
    expect(result.sampleSize).toBe(11);
  });

  it('menghitung coverage pegawai aktif tanpa membagi nol', async () => {
    const result = await getBoardActivityAnalytics(db, RANGE);
    // Seed: 11 pegawai, 1 RESIGNED -> 10 aktif. Yang punya event: 5 -> 50%.
    expect(result.analysis.activeEmployees).toBe(10);
    expect(result.analysis.coveragePercentage).toBe(50);
    expect(Number.isFinite(result.analysis.coveragePercentage)).toBe(true);
  });

  it('menghasilkan analisis kosong yang aman saat tidak ada data', async () => {
    const result = await getBoardActivityAnalytics(db, {
      fromDate: '2020-01-01',
      toDate: '2020-01-05',
    });
    expect(result.totalEvents).toBe(0);
    expect(result.byEventType).toEqual([]);
    expect(result.analysis.busiestDepartment).toBeNull();
    expect(result.analysis.coveragePercentage).toBe(0);
    expect(result.analysis.highlights[0]).toMatch(/Belum ada aktivitas/i);
  });

  it('menyaring berdasarkan tipe event', async () => {
    const result = await getBoardActivityAnalytics(db, { ...RANGE, eventType: 'KPI_DAILY' });
    expect(result.byEventType).toHaveLength(1);
    expect(result.byEventType[0].eventType).toBe('KPI_DAILY');
  });

  it('menyaring berdasarkan pencarian nama pegawai', async () => {
    const result = await getBoardActivityAnalytics(db, { ...RANGE, search: 'Budi' });
    expect(result.recent.length).toBeGreaterThan(0);
    expect(result.recent.every((r) => r.employeeName.includes('Budi'))).toBe(true);
  });
});
