import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import {
  createCorporateKpi,
  createDivisionKpi,
  createManagerKpi,
  createPositionKpi,
  getCascadeIntegrity,
  getCascadeTree,
  listCorporateKpis,
  listDivisionKpis,
  listManagerKpis,
  listPositionKpis,
} from '@/lib/services/kpiCascadeService';

let client: PGlite;
let db: Db;
const BOD = { userId: 'e0000000-0000-4000-8000-000000000001', employeeId: 'b0000000-0000-4000-8000-000000000001', role: 'BOD' };
const HR = { userId: 'e0000000-0000-4000-8000-000000000002', employeeId: 'b0000000-0000-4000-8000-000000000002', role: 'HR_MANAGER' };
const PM = { userId: 'e0000000-0000-4000-8000-000000000003', employeeId: 'b0000000-0000-4000-8000-000000000003', role: 'PEOPLE_MANAGER' };

beforeAll(async () => {
  ({ client } = await createTestDb());
  await runSeed(client);
  db = drizzle(client) as unknown as Db;
});

afterAll(async () => {
  await client.close();
});

describe('layanan KPI berjenjang', () => {
  it('menampilkan KPI korporat bersama pilar dan jumlah turunannya', async () => {
    const items = await listCorporateKpis(db, 2026);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]).toHaveProperty('pillarName');
    expect(items[0]).toHaveProperty('divisionKpiCount');
  });

  it('membuat entri di tiap tingkat, menulis audit, dan membentuk pohon terhubung', async () => {
    const corporate = await createCorporateKpi(db, BOD, {
      pillarId: 'c0000000-0000-4000-8000-000000000001', periodYear: 2032,
      kpiName: 'Pertumbuhan pendapatan tahunan', targetValue: 12, unitOfMeasure: '%', kpiCode: 'CORP-TEST-2032',
    });
    const division = await createDivisionKpi(db, HR, {
      corporateKpiId: corporate.id, departmentId: 'a0000000-0000-4000-8000-000000000101',
      kpiTitle: 'Efisiensi operasional teknologi', targetValue: 10, weightPct: 40,
    });
    const manager = await createManagerKpi(db, PM, {
      divisionKpiId: division.id, employeeId: 'b0000000-0000-4000-8000-000000000003',
      kpiTitle: 'Peningkatan efisiensi tim', targetValue: 9, unitOfMeasure: '%', weightPct: 50,
    });
    const position = await createPositionKpi(db, PM, {
      managerKpiId: manager.id, positionId: 'a0000000-0000-4000-8000-000000000204',
      kpiTitle: 'Optimalisasi layanan aplikasi', targetValue: 8, unitOfMeasure: '%', weightPct: 30,
    });

    expect((await listDivisionKpis(db, corporate.id)).some((item) => item.id === division.id)).toBe(true);
    expect((await listManagerKpis(db, division.id)).some((item) => item.id === manager.id)).toBe(true);
    expect((await listPositionKpis(db, manager.id)).some((item) => item.id === position.id)).toBe(true);
    const tree = await getCascadeTree(db);
    expect(JSON.stringify(tree)).toContain('Optimalisasi layanan aplikasi');
    const integrity = await getCascadeIntegrity(db);
    expect(integrity.putus.some((item) => item.kode === position.id)).toBe(false);
  });

  it('menolak penetapan KPI korporat oleh HR dan bobot di luar rentang', async () => {
    await expect(createCorporateKpi(db, HR, {
      pillarId: 'c0000000-0000-4000-8000-000000000001', periodYear: 2033,
      kpiName: 'KPI terlarang', targetValue: 5, unitOfMeasure: '%', kpiCode: 'CORP-FORBIDDEN',
    })).rejects.toThrow();
    await expect(createDivisionKpi(db, HR, {
      corporateKpiId: 'c0000000-0000-4000-8000-000000000101', departmentId: 'a0000000-0000-4000-8000-000000000101',
      kpiTitle: 'Bobot tidak sah', targetValue: 5, weightPct: 101,
    })).rejects.toThrow(/bobot/i);
  });
});
