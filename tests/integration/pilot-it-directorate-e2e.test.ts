import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { saveEntry, verifyEntry } from '@/lib/services/dailyKpiService';
import { storeSnapshot, getRecap } from '@/lib/services/dailyPerformanceService';
import { verifyAuditChain, insertAuditLog } from '@/lib/repositories/auditRepository';
import { sql } from 'drizzle-orm';

describe('Pilot Testing: Direktorat IT & Engineering (Full Cycle)', () => {
  let client: PGlite;
  let db: Db;

  // Budi Pratama (Senior Software Engineer, IT)
  const BUDI_ID = 'b0000000-0000-4000-8000-000000000004';
  // Raden Mas Danu (Atasan Langsung / People Manager, IT)
  const DANU_ID = 'b0000000-0000-4000-8000-000000000003';
  let indicatorId = '';

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;

    // Ambil period dan pillar untuk mengaitkan KPI
    const period = await db.execute(sql`SELECT id FROM appraisal_periods LIMIT 1`);
    const pillar = await db.execute(sql`SELECT id FROM strategic_pillars LIMIT 1`);
    const periodId = (period.rows[0] as { id: string }).id;
    const pillarId = (pillar.rows[0] as { id: string }).id;

    // Siapkan KPI dan Indikator untuk Budi Pratama
    const kpi = await db.execute(sql`
      INSERT INTO individual_kpis
        (period_id, employee_id, strategic_pillar_id, kpi_title, target_value, unit_of_measure, kpi_weight)
      VALUES (${periodId}::uuid, ${BUDI_ID}::uuid, ${pillarId}::uuid, 'Sprint Delivery & SLA IT', 10, 'tiket', 100)
      RETURNING id
    `);
    const kpiId = (kpi.rows[0] as { id: string }).id;

    const ind = await db.execute(sql`
      INSERT INTO kpi_indicators (kpi_id, indicator_name, target_value, indicator_weight)
      VALUES (${kpiId}::uuid, 'Tiket Selesai Tepat Waktu', 10, 100)
      RETURNING id
    `);
    indicatorId = (ind.rows[0] as { id: string }).id;
  });

  afterAll(async () => {
    await client.close();
  });

  it('1. Memastikan profil karyawan percontohan dan atasannya aktif di IT', async () => {
    const res = await db.execute(sql`
      SELECT e.id, e.full_name, d.department_name
      FROM employees e
      JOIN departments d ON d.id = e.department_id
      WHERE e.id = ${BUDI_ID}::uuid
    `);
    expect(res.rows.length).toBe(1);
    const row = res.rows[0] as { full_name: string; department_name: string };
    expect(row.full_name).toContain('Budi Pratama');
    expect(row.department_name).toContain('Technology');
  });

  it('2. Simulasi input KPI harian oleh karyawan dan verifikasi oleh atasan', async () => {
    const today = new Date().toISOString().slice(0, 10);

    // Karyawan submit entri harian
    const entry = await saveEntry(db, {
      indicatorId,
      employeeId: BUDI_ID,
      entryDate: today,
      actualValue: 10,
      note: 'Menyelesaikan modul pengujian percontohan sesuai target SLA',
      submit: true,
    });
    expect(entry.status).toBe('SUBMITTED');

    // Catat ke audit log
    await insertAuditLog(db, {
      userId: 'e0000000-0000-4000-8000-000000000004',
      actionType: 'CREATE',
      entityName: 'kpi_daily_entries',
      recordId: entry.id,
      description: 'Pilot test: input KPI harian oleh karyawan IT',
    });

    // Atasan verifikasi entri
    const verified = await verifyEntry(db, {
      entryId: entry.id,
      verifierId: 'e0000000-0000-4000-8000-000000000003',
      decision: 'VERIFIED',
    });
    expect(verified.status).toBe('VERIFIED');

    // Catat verifikasi ke audit log
    await insertAuditLog(db, {
      userId: 'e0000000-0000-4000-8000-000000000003',
      actionType: 'UPDATE',
      entityName: 'kpi_daily_entries',
      recordId: entry.id,
      description: 'Pilot test: verifikasi KPI harian oleh People Manager IT',
    });
  });

  it('3. Simulasi snapshot DPI harian dan agregasi rekap', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const snap = await storeSnapshot(db, BUDI_ID, today);
    expect(snap).toBeDefined();
    expect(snap.employeeId).toBe(BUDI_ID);

    const recap = await getRecap(db, BUDI_ID, 'monthly', today);
    expect(recap).toBeDefined();
    expect(recap.period).toBe('monthly');
  });

  it('4. Audit Keamanan: Rantai Hash Audit Trail Utuh (Anti-Tampering)', async () => {
    const auditStatus = await verifyAuditChain(db);
    expect(auditStatus.ok).toBe(true);
    expect(auditStatus.firstBrokenId).toBeNull();
    expect(auditStatus.checked).toBeGreaterThanOrEqual(2);
  });
});
