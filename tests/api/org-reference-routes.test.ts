import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { NextRequest } from 'next/server';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as listDepts, POST as createDept } from '@/app/api/v1/recruitment/departments/route';
import { GET as listPos, POST as createPos } from '@/app/api/v1/recruitment/positions/route';
import { GET as listPlans } from '@/app/api/v1/recruitment/manpower-plans/route';

function req(path: string, method: string, body?: unknown, cookie?: string): NextRequest {
  const headers = new Headers();
  if (body) headers.set('Content-Type', 'application/json');
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest(`http://localhost:3000${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
}
function getReq(path: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers });
}

const HR_USER = 'e0000000-0000-4000-8000-000000000002';
const EMP_USER = 'e0000000-0000-4000-8000-000000000004';

describe('Self-service referensi organisasi: departemen & posisi', () => {
  let hrCookie = '';
  let empCookie = '';
  let newDeptId = '';
  const suffix = Date.now().toString().slice(-6);
  const deptName = `Direktorat Uji ${suffix}`;
  const posName = `Staf Uji ${suffix}`;

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: HR_USER, employeeId: null, role: 'HR_MANAGER', email: 'siti.nurhaliza@eperformiq.co.id' })}`;
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: EMP_USER, employeeId: 'b0000000-0000-4000-8000-000000000004', role: 'EMPLOYEE', email: 'budi.pratama@eperformiq.co.id' })}`;
  });

  it('401 tanpa sesi (departemen)', async () => {
    expect((await listDepts(getReq('/x'))).status).toBe(401);
  });

  it('EMPLOYEE tidak boleh membaca departemen (403)', async () => {
    expect((await listDepts(getReq('/x', empCookie))).status).toBe(403);
  });

  it('GET departemen (HR) memuat referensi seed + jumlah posisi', async () => {
    const res = await listDepts(getReq('/x', hrCookie));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.data.departments.length).toBeGreaterThanOrEqual(5);
    expect(typeof j.data.departments[0].positionCount).toBe('number');
  });

  it('GET posisi (HR) memuat referensi seed', async () => {
    const res = await listPos(getReq('/x', hrCookie));
    expect(res.status).toBe(200);
    expect((await res.json()).data.positions.length).toBeGreaterThanOrEqual(7);
  });

  it('EMPLOYEE tidak boleh menambah departemen (403)', async () => {
    expect((await createDept(req('/x', 'POST', { departmentName: deptName }, empCookie))).status).toBe(403);
  });

  it('POST departemen baru (HR) → 201 & tampil di daftar', async () => {
    const res = await createDept(req('/x', 'POST', { departmentName: deptName, divisionName: 'Uji Coba' }, hrCookie));
    expect(res.status).toBe(201);
    newDeptId = (await res.json()).data.id;
    const list = await (await listDepts(getReq('/x', hrCookie))).json();
    expect(list.data.departments.some((d: any) => d.id === newDeptId && d.name === deptName)).toBe(true);
  });

  it('POST departemen duplikat (nama sama) → 409', async () => {
    const res = await createDept(req('/x', 'POST', { departmentName: deptName }, hrCookie));
    expect(res.status).toBe(409);
  });

  it('POST posisi baru di departemen baru (HR) → 201 & tampil difilter', async () => {
    const res = await createPos(req('/x', 'POST', { departmentId: newDeptId, positionTitle: posName, jobGrade: '3' }, hrCookie));
    expect(res.status).toBe(201);
    const list = await (await listPos(getReq(`/x?departmentId=${newDeptId}`, hrCookie))).json();
    expect(list.data.positions.some((p: any) => p.title === posName && p.departmentId === newDeptId)).toBe(true);
  });

  it('POST posisi duplikat dalam departemen sama → 409', async () => {
    const res = await createPos(req('/x', 'POST', { departmentId: newDeptId, positionTitle: posName }, hrCookie));
    expect(res.status).toBe(409);
  });

  it('POST posisi di departemen tak dikenal → 409', async () => {
    const res = await createPos(req('/x', 'POST', { departmentId: '00000000-0000-4000-8000-000000000000', positionTitle: 'Posisi Hantu' }, hrCookie));
    expect(res.status).toBe(409);
  });

  it('departemen/posisi baru tersinkron ke referensi MPP', async () => {
    const j = await (await listPlans(getReq('/x', hrCookie))).json();
    expect(j.data.departments.some((d: any) => d.id === newDeptId)).toBe(true);
    expect(j.data.positions.some((p: any) => p.departmentId === newDeptId && p.title === posName)).toBe(true);
  });

  // Tes ini memakai database bersama, jadi wajib membersihkan dirinya sendiri:
  // tanpa ini, setiap run meninggalkan satu "Direktorat Uji ..." yang muncul
  // sebagai departemen palsu pada kartu Indikator Pencapaian Target.
  afterAll(async () => {
    const client = await getDb();
    await client.query('DELETE FROM job_positions WHERE department_id = $1', [newDeptId]).catch(() => {});
    await client.query('DELETE FROM departments WHERE id = $1', [newDeptId]).catch(() => {});
  });
});
