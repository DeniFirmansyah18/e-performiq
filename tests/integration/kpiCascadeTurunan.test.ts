import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getTargets } from '@/app/api/v1/performance/kpi-cascade/targets/route';
import { POST as genDivisi } from '@/app/api/v1/performance/kpi-cascade/division/generate/route';
import { POST as genManajer } from '@/app/api/v1/performance/kpi-cascade/manager/generate/route';

/**
 * Rantai KPI BOD -> HR -> People Manager:
 *   - HR melihat KPI direktur lalu menyusun KPI divisi (AI/manual).
 *   - HR menugaskan KPI divisi ke People Manager.
 * Endpoint generate hanya mengusulkan; penyimpanan lewat POST biasa.
 */
let cookieHr = '';
let cookiePm = '';
let cookieEmployee = '';
let corporateKpiId = '';
let divisionKpiId = '';
let departmentId = '';
let pmEmployeeId = '';

function reqJson(url: string, body: unknown, cookie: string) {
  return new NextRequest(`http://localhost:3000${url}`, {
    method: 'POST',
    headers: new Headers({ 'Content-Type': 'application/json', cookie }),
    body: JSON.stringify(body),
  });
}

function reqGet(url: string, cookie: string) {
  return new NextRequest(`http://localhost:3000${url}`, {
    method: 'GET',
    headers: new Headers({ cookie }),
  });
}

beforeAll(async () => {
  const db = await getDb();
  await runSeed(db);

  const hr = await db.query(
    `SELECT u.id::text AS uid, e.id::text AS eid
       FROM users u JOIN employees e ON e.id = u.employee_id
      WHERE e.employee_code = 'HRM-2018-0002' LIMIT 1`
  );
  const pm = await db.query(
    `SELECT u.id::text AS uid, e.id::text AS eid
       FROM users u JOIN employees e ON e.id = u.employee_id
      WHERE u.role = 'PEOPLE_MANAGER' LIMIT 1`
  );
  const emp = await db.query(
    `SELECT u.id::text AS uid, e.id::text AS eid
       FROM users u JOIN employees e ON e.id = u.employee_id
      WHERE e.employee_code = 'EMP-2022-0042' LIMIT 1`
  );

  cookieHr = `${SESSION_COOKIE_NAME}=${await signSession({ userId: hr.rows[0].uid, employeeId: hr.rows[0].eid, role: 'HR_MANAGER', email: 'hr@eperformiq.co.id' } as any)}`;
  cookiePm = `${SESSION_COOKIE_NAME}=${await signSession({ userId: pm.rows[0].uid, employeeId: pm.rows[0].eid, role: 'PEOPLE_MANAGER', email: 'pm@eperformiq.co.id' } as any)}`;
  cookieEmployee = `${SESSION_COOKIE_NAME}=${await signSession({ userId: emp.rows[0].uid, employeeId: emp.rows[0].eid, role: 'EMPLOYEE', email: 'emp@eperformiq.co.id' } as any)}`;
  pmEmployeeId = pm.rows[0].eid;

  const ck = await db.query(`SELECT id::text AS id FROM corporate_kpis ORDER BY kpi_code LIMIT 1`);
  corporateKpiId = ck.rows[0]?.id ?? '';

  const dk = await db.query(
    `SELECT dk.id::text AS id, dk.department_id::text AS dept
       FROM division_kpis dk ORDER BY dk.kpi_title LIMIT 1`
  );
  divisionKpiId = dk.rows[0]?.id ?? '';
  departmentId = dk.rows[0]?.dept ?? '';

  if (!departmentId) {
    const d = await db.query(`SELECT id::text AS id FROM departments ORDER BY department_name LIMIT 1`);
    departmentId = d.rows[0]?.id ?? '';
  }
}, 120000);

describe('pilihan pemilik KPI per tingkat', () => {
  it('HR dapat melihat departemen (tingkat DEPARTEMEN)', async () => {
    const res = await getTargets(reqGet('/api/v1/performance/kpi-cascade/targets?tingkat=DEPARTEMEN', cookieHr));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(json.data.items)).toBe(true);
  });

  it('HR dapat melihat People Manager (tingkat MANAJER)', async () => {
    const res = await getTargets(reqGet('/api/v1/performance/kpi-cascade/targets?tingkat=MANAJER', cookieHr));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.items.length).toBeGreaterThan(0);
    expect(json.data.items[0]).toHaveProperty('nama');
  });

  it('People Manager dapat melihat posisi (tingkat POSISI)', async () => {
    const res = await getTargets(reqGet('/api/v1/performance/kpi-cascade/targets?tingkat=POSISI', cookiePm));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(json.data.items)).toBe(true);
  });

  it('pegawai ditolak saat meminta pilihan pemilik KPI', async () => {
    const res = await getTargets(reqGet('/api/v1/performance/kpi-cascade/targets?tingkat=DEPARTEMEN', cookieEmployee));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('usulan KPI divisi dari KPI direktur', () => {
  it('HR mendapat usulan + sumber + induk', async () => {
    expect(corporateKpiId).toBeTruthy();
    expect(departmentId).toBeTruthy();
    const res = await genDivisi(
      reqJson('/api/v1/performance/kpi-cascade/division/generate', {
        corporate_kpi_id: corporateKpiId,
        department_id: departmentId,
      }, cookieHr)
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(json.data.usulan)).toBe(true);
    expect(json.data.usulan.length).toBeGreaterThanOrEqual(2);
    expect(['AI', 'FALLBACK']).toContain(json.data.sumber);
    expect(json.data.induk.id).toBe(corporateKpiId);
    const totalBobot = json.data.usulan.reduce((a: number, u: any) => a + u.weightPct, 0);
    expect(Math.round(totalBobot)).toBe(100);
  });

  it('pegawai tidak boleh menyusun KPI divisi', async () => {
    const res = await genDivisi(
      reqJson('/api/v1/performance/kpi-cascade/division/generate', {
        corporate_kpi_id: corporateKpiId,
        department_id: departmentId,
      }, cookieEmployee)
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('penugasan KPI divisi ke People Manager', () => {
  it('HR dapat meminta usulan KPI manajer', async () => {
    expect(divisionKpiId).toBeTruthy();
    expect(pmEmployeeId).toBeTruthy();
    const res = await genManajer(
      reqJson('/api/v1/performance/kpi-cascade/manager/generate', {
        division_kpi_id: divisionKpiId,
        employee_id: pmEmployeeId,
      }, cookieHr)
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(json.data.usulan)).toBe(true);
    expect(json.data.usulan.length).toBeGreaterThanOrEqual(2);
  });
});
