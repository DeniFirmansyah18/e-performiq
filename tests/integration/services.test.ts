import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import * as kpiService from '@/lib/services/kpiService';
import * as appraisalService from '@/lib/services/appraisalService';
import * as auditService from '@/lib/services/auditService';
import { BusinessRuleError, ForbiddenError, ImmutableRecordError } from '@/lib/auth/errors';
import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const DANU = 'b0000000-0000-4000-8000-000000000003';
const SITI = 'b0000000-0000-4000-8000-000000000002';
const BAMBANG = 'b0000000-0000-4000-8000-000000000005';
const ANISA = 'b0000000-0000-4000-8000-000000000007';
const PERIOD_ID = 'd0000000-0000-4000-8000-000000000001';
const PILLAR_FIN = 'c0000000-0000-4000-8000-000000000001';
const DIV_FIN = 'c0000000-0000-4000-8000-000000000201';

const ROLE_USER_IDS: Record<string, string> = {
  EMPLOYEE: 'e0000000-0000-4000-8000-000000000004',
  PEOPLE_MANAGER: 'e0000000-0000-4000-8000-000000000003',
  HR_MANAGER: 'e0000000-0000-4000-8000-000000000002',
  AUDITOR: 'e0000000-0000-4000-8000-000000000005',
};

const sess = (role: string, employeeId: string, email: string): SessionPayload => ({
  userId: ROLE_USER_IDS[role] ?? 'e0000000-0000-4000-8000-000000000006',
  employeeId,
  role: role as any,
  email,
});

describe('kpiService & appraisalService', () => {
  let client: PGlite;
  let db: Db;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
  });

  afterAll(async () => {
    await client.close();
  });

  it('Budi dapat membaca daftar KPI miliknya sendiri', async () => {
    const kpis = await kpiService.getEmployeeKpis(db, sess('EMPLOYEE', BUDI, 'budi@x.id'), BUDI, PERIOD_ID);
    expect(kpis.length).toBe(4);
    expect(kpis[0]).toHaveProperty('strategicPillarName');
  });

  it('Budi ditolak saat mencoba membaca KPI Anisa (403)', async () => {
    await expect(
      kpiService.getEmployeeKpis(db, sess('EMPLOYEE', BUDI, 'budi@x.id'), ANISA, PERIOD_ID)
    ).rejects.toThrow(ForbiddenError);
  });

  it('Danu (manager) dapat membaca KPI Budi sebagai bawahannya', async () => {
    const kpis = await kpiService.getEmployeeKpis(db, sess('PEOPLE_MANAGER', DANU, 'danu@x.id'), BUDI, PERIOD_ID);
    expect(kpis.length).toBe(4);
  });

  it('menolak pembuatan KPI jika total bobot melebihi 100% (422)', async () => {
    // Budi sudah punya bobot total 100 (30 + 25 + 25 + 20)
    await expect(
      kpiService.submitIndividualKpi(db, sess('EMPLOYEE', BUDI, 'budi@x.id'), {
        employeeId: BUDI,
        periodId: PERIOD_ID,
        strategicPillarId: PILLAR_FIN,
        divisionKpiId: DIV_FIN,
        kpiTitle: 'KPI Tambahan Melebihi Kuota',
        targetValue: 100,
        kpiWeight: 15,
      })
    ).rejects.toThrow(BusinessRuleError);
  });

  it('menolak pembuatan KPI dengan target_value nol atau negatif (422)', async () => {
    await expect(
      kpiService.submitIndividualKpi(db, sess('EMPLOYEE', ANISA, 'anisa@x.id'), {
        employeeId: ANISA,
        periodId: PERIOD_ID,
        strategicPillarId: PILLAR_FIN,
        divisionKpiId: DIV_FIN,
        kpiTitle: 'KPI Target Nol',
        targetValue: 0,
        kpiWeight: 10,
      })
    ).rejects.toThrow(BusinessRuleError);
  });

  it('menolak update realisasi actual_value negatif (422)', async () => {
    const kpis = await kpiService.getEmployeeKpis(db, sess('EMPLOYEE', BUDI, 'budi@x.id'), BUDI, PERIOD_ID);
    await expect(
      kpiService.updateKpiActualValue(db, sess('EMPLOYEE', BUDI, 'budi@x.id'), kpis[0].id, -10)
    ).rejects.toThrow(BusinessRuleError);
  });

  it('Budi dapat update realisasi KPI miliknya dan achievement_percentage terhitung', async () => {
    const kpis = await kpiService.getEmployeeKpis(db, sess('EMPLOYEE', BUDI, 'budi@x.id'), BUDI, PERIOD_ID);
    const updated = await kpiService.updateKpiActualValue(db, sess('EMPLOYEE', BUDI, 'budi@x.id'), kpis[0].id, 100);
    expect(Number(updated.actualValue)).toBe(100);
    expect(Number(updated.achievementPercentage)).toBeGreaterThan(0);
  });

  it('Danu dapat menyetujui KPI bawahannya', async () => {
    const kpis = await kpiService.getEmployeeKpis(db, sess('PEOPLE_MANAGER', DANU, 'danu@x.id'), BUDI, PERIOD_ID);
    const approved = await kpiService.approveKpi(db, sess('PEOPLE_MANAGER', DANU, 'danu@x.id'), kpis[0].id);
    expect(approved.status).toBe('APPROVED');
  });

  it('Budi tidak boleh menyetujui KPI-nya sendiri (403)', async () => {
    const kpis = await kpiService.getEmployeeKpis(db, sess('EMPLOYEE', BUDI, 'budi@x.id'), BUDI, PERIOD_ID);
    await expect(
      kpiService.approveKpi(db, sess('EMPLOYEE', BUDI, 'budi@x.id'), kpis[0].id)
    ).rejects.toThrow(ForbiddenError);
  });

  it('Budi dapat menyesuaikan bobot KPI miliknya selama total <= 100%', async () => {
    const kpis = await kpiService.getEmployeeKpis(db, sess('EMPLOYEE', BUDI, 'budi@x.id'), BUDI, PERIOD_ID);
    // Ubah KPI pertama (semula 30) menjadi 20
    const updated = await kpiService.updateKpiWeight(db, sess('EMPLOYEE', BUDI, 'budi@x.id'), kpis[0].id, 20);
    expect(Number(updated.kpiWeight)).toBe(20);

    // Sekarang total bobot Budi adalah 20 + 25 + 25 + 20 = 90% (ada sisa kuota 10%)
    // Budi sekarang bisa menambah milestone baru berbobot 10%
    const newKpi = await kpiService.submitIndividualKpi(db, sess('EMPLOYEE', BUDI, 'budi@x.id'), {
      employeeId: BUDI,
      periodId: PERIOD_ID,
      strategicPillarId: PILLAR_FIN,
      kpiTitle: 'KPI Baru Pengisi Kuota 10%',
      targetValue: 50,
      kpiWeight: 10,
    });
    expect(Number(newKpi.kpiWeight)).toBe(10);

    // Bersihkan KPI baru
    await kpiService.removeIndividualKpi(db, sess('EMPLOYEE', BUDI, 'budi@x.id'), newKpi.id);
    // Kembalikan bobot semula
    await kpiService.updateKpiWeight(db, sess('EMPLOYEE', BUDI, 'budi@x.id'), kpis[0].id, 30);
  });

  it('HR Manager dapat menghitung Composite GPA Budi', async () => {
    const appraisal = await appraisalService.calculateAndSaveGPA(db, sess('HR_MANAGER', SITI, 'siti@x.id'), {
      periodId: PERIOD_ID,
      employeeId: ANISA,
      kpiScore: 88,
      sopScore: 92,
      competencyScore: 85,
      coreValuesScore: 90,
      potentialScore: 3.5,
    });
    expect(appraisal.totalPercentageScore).toBeGreaterThan(0);
    expect(appraisal.compositeGPA).toBeGreaterThan(0);
  });

  it('menolak kalibrasi ulang jika sudah is_calibrated = true (409)', async () => {
    // Di seed, appraisal Budi sudah is_calibrated = true
    const budiAppraisal = await appraisalService.getAppraisalByEmployee(db, BUDI, PERIOD_ID);
    expect(budiAppraisal?.isCalibrated).toBe(true);

    await expect(
      appraisalService.calibrateAppraisal(db, sess('HR_MANAGER', SITI, 'siti@x.id'), budiAppraisal!.id, 'Kalibrasi kedua')
    ).rejects.toThrow(ImmutableRecordError);
  });

  it('Auditor dapat membaca audit log', async () => {
    const logs = await auditService.getAuditLogs(db, sess('AUDITOR', BAMBANG, 'bambang@x.id'));
    expect(logs.length).toBeGreaterThan(0);
  });

  it('Employee ditolak saat mencoba membaca audit log (403)', async () => {
    await expect(
      auditService.getAuditLogs(db, sess('EMPLOYEE', BUDI, 'budi@x.id'))
    ).rejects.toThrow(ForbiddenError);
  });
});
