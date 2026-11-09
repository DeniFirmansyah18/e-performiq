import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { NextRequest } from 'next/server';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getTargetAchievement } from '@/app/api/v1/performance/target-achievement/route';
import {
  getAchievementStatus,
  getStatusLabel,
  getStatusColor,
} from '@/lib/services/targetAchievementService';

const MGR_USER = 'e0000000-0000-4000-8000-000000000003';
const MGR_EMP = 'b0000000-0000-4000-8000-000000000003';

const HR_USER = 'e0000000-0000-4000-8000-000000000002';
const HR_EMP = 'b0000000-0000-4000-8000-000000000002';

const BOD_USER = 'e0000000-0000-4000-8000-000000000001';
const BOD_EMP = 'b0000000-0000-4000-8000-000000000001';


const BUDI_USER = 'e0000000-0000-4000-8000-000000000004';
const BUDI_EMP = 'b0000000-0000-4000-8000-000000000004';

function reqWithCookie(path: string, token: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'GET',
    headers: new Headers({
      cookie: `${SESSION_COOKIE_NAME}=${token}`,
    }),
  });
}

describe('Target Achievement Indicator (% Pencapaian Target)', () => {
  let client: PGlite;
  let budiToken: string;
  let mgrToken: string;
  let hrToken: string;
  let bodToken: string;
  let outsiderEmpId: string;
  let outsiderToken: string;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);

    // Budi Santoso (EMPLOYEE)
    budiToken = await signSession({
      userId: BUDI_USER,
      employeeId: BUDI_EMP,
      role: 'EMPLOYEE',
      email: 'budi.santoso@eperformiq.co.id',
    });

    // Raden Mas Danu (PEOPLE_MANAGER)
    mgrToken = await signSession({
      userId: MGR_USER,
      employeeId: MGR_EMP,
      role: 'PEOPLE_MANAGER',
      email: 'danu.tech@eperformiq.co.id',
    });

    // HR Manager
    hrToken = await signSession({
      userId: HR_USER,
      employeeId: HR_EMP,
      role: 'HR_MANAGER',
      email: 'hr.manager@eperformiq.co.id',
    });

    // BOD (Executive)
    bodToken = await signSession({
      userId: BOD_USER,
      employeeId: BOD_EMP,
      role: 'BOD',
      email: 'hendra.gunawan@eperformiq.co.id',
    });


    // Buat karyawan baru di luar hierarki Siti untuk uji pembatasan scope 403
    const outsiderRes = await client.query<{ id: string }>(
      `INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date, manager_id)
       VALUES (gen_random_uuid(), 'EMP-OUTSIDER-001', 'Karyawan Luar', 'outsider@eperformiq.co.id',
               'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
               'PERMANENT', 8000000, CURRENT_DATE, NULL)
       RETURNING id`,
    );
    outsiderEmpId = outsiderRes.rows[0].id;
    outsiderToken = await signSession({
      userId: 'u-outsider-01',
      employeeId: outsiderEmpId,
      role: 'EMPLOYEE',
      email: 'outsider@eperformiq.co.id',
    });
  });

  afterAll(async () => {
    await client.close();
  });

  describe('Helper fungsi status & warna', () => {
    it('mengelompokkan status dengan benar berdasarkan nilai persentase', () => {
      expect(getAchievementStatus(115.5)).toBe('EXCEEDED');
      expect(getAchievementStatus(100.0)).toBe('EXCEEDED');
      expect(getAchievementStatus(95.0)).toBe('ON_TRACK');
      expect(getAchievementStatus(80.0)).toBe('ON_TRACK');
      expect(getAchievementStatus(75.5)).toBe('AT_RISK');
      expect(getAchievementStatus(60.0)).toBe('AT_RISK');
      expect(getAchievementStatus(59.9)).toBe('CRITICAL');
      expect(getAchievementStatus(0.0)).toBe('CRITICAL');
    });

    it('mengembalikan label status bahasa Indonesia yang baku', () => {
      expect(getStatusLabel('EXCEEDED')).toBe('Melampaui Target');
      expect(getStatusLabel('ON_TRACK')).toBe('Sesuai Jalur');
      expect(getStatusLabel('AT_RISK')).toBe('Perlu Perhatian');
      expect(getStatusLabel('CRITICAL')).toBe('Di Bawah Target');
    });

    it('mengembalikan token warna Tailwind yang konsisten', () => {
      const exceededColor = getStatusColor('EXCEEDED');
      expect(exceededColor.bar).toContain('bg-emerald');
      expect(exceededColor.text).toContain('text-emerald');
    });
  });

  describe('Role EMPLOYEE', () => {
    it('mengembalikan capaian KPI pribadi dengan scope INDIVIDUAL', async () => {
      const res = await getTargetAchievement(
        reqWithCookie('/api/v1/performance/target-achievement', budiToken)
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.scopeLevel).toBe('INDIVIDUAL');
      expect(json.data.overallPercentage).toBeGreaterThan(0);
      expect(Number.isFinite(json.data.overallPercentage)).toBe(true);
      expect(Array.isArray(json.data.individualKpis)).toBe(true);
      expect(json.data.individualKpis.length).toBeGreaterThanOrEqual(1);

      // Verifikasi struktur KPI individu
      const firstKpi = json.data.individualKpis[0];
      expect(firstKpi.title).toBeTruthy();
      expect(firstKpi.targetValue).toBeGreaterThan(0);
      expect(firstKpi.achievementPercentage).toBeGreaterThan(0);
      expect(firstKpi.weight).toBeGreaterThan(0);
    });

    it('menolak upaya EMPLOYEE mengakses data target karyawan lain dengan status 403', async () => {
      const res = await getTargetAchievement(
        reqWithCookie(
          `/api/v1/performance/target-achievement?employee_id=${BUDI_EMP}`,
          outsiderToken
        )
      );
      expect(res.status).toBe(403);
    });
  });

  describe('Role PEOPLE_MANAGER', () => {
    it('mengembalikan capaian rata-rata tim dengan scope TEAM', async () => {
      const res = await getTargetAchievement(
        reqWithCookie('/api/v1/performance/target-achievement', mgrToken)
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.scopeLevel).toBe('TEAM');
      expect(json.data.overallPercentage).toBeGreaterThan(0);
      expect(Array.isArray(json.data.teamMembers)).toBe(true);
      expect(json.data.teamMembers.length).toBeGreaterThanOrEqual(1);

      // Budi harus ada di dalam tim Siti
      const budiInTeam = json.data.teamMembers.find((m: any) => m.employeeId === BUDI_EMP);
      expect(budiInTeam).toBeTruthy();
      expect(budiInTeam.fullName).toContain('Budi');
      expect(budiInTeam.achievementPercentage).toBeGreaterThan(0);

      // Ada ringkasan KPI pribadi manajer
      expect(json.data.myOwn).toBeDefined();
    });

    it('mengizinkan manajer membaca detail spesifik bawahannya via ?employee_id=', async () => {
      const res = await getTargetAchievement(
        reqWithCookie(
          `/api/v1/performance/target-achievement?employee_id=${BUDI_EMP}`,
          mgrToken
        )
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.scopeLevel).toBe('INDIVIDUAL');
      expect(json.data.individualKpis.length).toBeGreaterThan(0);
    });

    it('menolak manajer membaca data karyawan di luar hierarki timnya dengan status 403', async () => {
      const res = await getTargetAchievement(
        reqWithCookie(
          `/api/v1/performance/target-achievement?employee_id=${outsiderEmpId}`,
          mgrToken
        )
      );
      expect(res.status).toBe(403);
    });
  });

  describe('Role HR_MANAGER & BOD (Organisasi)', () => {
    it('mengembalikan agregat capaian seluruh organisasi dan breakdown departemen untuk HR', async () => {
      const res = await getTargetAchievement(
        reqWithCookie('/api/v1/performance/target-achievement', hrToken)
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.scopeLevel).toBe('ORGANIZATION');
      expect(json.data.overallPercentage).toBeGreaterThan(0);
      expect(Array.isArray(json.data.departments)).toBe(true);
      expect(json.data.departments.length).toBeGreaterThanOrEqual(1);

      // Department Engineering terdaftar
      const engDept = json.data.departments.find(
        (d: any) => d.departmentName.toLowerCase().includes('engineer') || d.departmentName.toLowerCase().includes('teknik')
      );
      expect(engDept).toBeTruthy();
    });


    it('mendukung filter departemen (?department_id=)', async () => {
      const deptList = await client.query<{ id: string }>(`SELECT id FROM departments LIMIT 1`);
      const deptId = deptList.rows[0].id;

      const res = await getTargetAchievement(
        reqWithCookie(
          `/api/v1/performance/target-achievement?department_id=${deptId}`,
          hrToken
        )
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.departments.length).toBe(1);
      expect(json.data.departments[0].departmentId).toBe(deptId);
      expect(Array.isArray(json.data.teamMembers)).toBe(true);
    });
  });

  describe('Role BOD (Dewan Direksi)', () => {
    it('mengembalikan capaian korporat dan rincian 4 Perspektif Balanced Scorecard (BSC)', async () => {
      const res = await getTargetAchievement(
        reqWithCookie('/api/v1/performance/target-achievement', bodToken)
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.scopeLevel).toBe('CORPORATE');
      expect(json.data.overallPercentage).toBeGreaterThan(0);
      expect(Array.isArray(json.data.perspectives)).toBe(true);

      // Memastikan 4 perspektif BSC ada
      const perspectives = json.data.perspectives.map((p: any) => p.perspective);
      expect(perspectives).toContain('FINANCIAL');
      expect(perspectives).toContain('CUSTOMER');
      expect(perspectives).toContain('INTERNAL_PROCESS');
      expect(perspectives).toContain('LEARNING_GROWTH');
    });
  });

  describe('Penanganan Overachievement (>100%)', () => {
    it('menampilkan persentase aktual asli ketika melebihi 100% dan status EXCEEDED', async () => {
      // Periksa KPI SLA Budi: Target 98, Realisasi 99.2 -> Capaian 101.2%
      const res = await getTargetAchievement(
        reqWithCookie('/api/v1/performance/target-achievement', budiToken)
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      const slaKpi = json.data.individualKpis.find((k: any) => k.title.includes('SLA'));
      expect(slaKpi).toBeTruthy();
      expect(slaKpi.achievementPercentage).toBeGreaterThan(100);
      expect(slaKpi.status).toBe('EXCEEDED');
    });
  });
});
