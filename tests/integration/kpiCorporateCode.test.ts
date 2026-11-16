import { describe, it, expect, beforeAll } from 'vitest';
import { runSeed } from '@/lib/db/seed';
import { db, getDb } from '@/lib/db/client';
import { createCorporateKpi } from '@/lib/services/kpiCascadeService';

/**
 * Regresi: dulu klien mengirim kpi_code tetap (mis. BOD-2026-01). Klik
 * "Setujui" kedua kali bentrok dengan UNIQUE kpi_code sehingga muncul
 * "Gagal membuat KPI korporat". Sekarang SERVER menjamin kode unik.
 */
let pillarId = '';
let actor: any = null;
const dibuat: string[] = [];

beforeAll(async () => {
  const raw: any = await getDb();
  await runSeed(raw);
  const p = (await raw.query(
    `SELECT id::text AS id FROM strategic_pillars WHERE is_active = TRUE ORDER BY strategic_weight DESC LIMIT 1`
  )) as unknown as { rows: Array<{ id: string }> };
  pillarId = p.rows[0]?.id ?? '';

  const u = (await raw.query(
    `SELECT u.id::text AS uid, e.id::text AS eid
       FROM users u JOIN employees e ON e.id = u.employee_id
      WHERE u.role = 'BOD' LIMIT 1`
  )) as unknown as { rows: Array<{ uid: string; eid: string }> };
  actor = {
    userId: u.rows[0]?.uid ?? '',
    employeeId: u.rows[0]?.eid ?? '',
    role: 'BOD',
  };
}, 120000);

describe('kode KPI korporat dibuat server (unik)', () => {
  it('kode yang diminta sudah dipakai -> tetap tersimpan dengan kode BARU', async () => {
    expect(pillarId).toBeTruthy();

    const a = await createCorporateKpi(db, actor, {
      pillarId,
      periodYear: 2026,
      kpiName: 'Uji kode pertama',
      targetValue: 90,
      unitOfMeasure: '%',
    });
    dibuat.push(a.id);

    // Kode yang sama diminta lagi: harus TIDAK gagal.
    const b = await createCorporateKpi(db, actor, {
      pillarId,
      periodYear: 2026,
      kpiName: 'Uji kode kedua',
      targetValue: 88,
      unitOfMeasure: '%',
      kpiCode: a.kpiCode,
    });
    dibuat.push(b.id);

    expect(b.id).toBeTruthy();
    expect(b.kpiCode).not.toBe(a.kpiCode);
  });

  it('tanpa kode -> server membuat kode berawalan CORP-', async () => {
    const c = await createCorporateKpi(db, actor, {
      pillarId,
      periodYear: 2026,
      kpiName: 'Uji tanpa kode',
      targetValue: 85,
      unitOfMeasure: '%',
    });
    dibuat.push(c.id);
    expect(c.kpiCode.startsWith('CORP-')).toBe(true);
  });

  it('membersihkan data uji', async () => {
    for (const id of dibuat) {
      await db.execute(`DELETE FROM kpi_cascade_log WHERE kode_hasil = '${id}'`);
      await db.execute(`DELETE FROM corporate_kpis WHERE id = '${id}'::uuid`);
    }
    expect(dibuat.length).toBe(3);
  });
});
