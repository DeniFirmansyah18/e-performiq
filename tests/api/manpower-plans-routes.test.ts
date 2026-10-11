import { describe, it, expect, beforeAll } from 'vitest';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { NextRequest } from 'next/server';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as listPlans, POST as createPlan } from '@/app/api/v1/recruitment/manpower-plans/route';
import { PATCH as patchPlan, DELETE as deletePlan } from '@/app/api/v1/recruitment/manpower-plans/[id]/route';

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

describe('Manajemen MPP (kuota & budget) — HR Command', () => {
  let hrCookie = '';
  let empCookie = '';
  let deptId = '';
  let posId = '';
  let seedPlanId = '';
  let createdId = '';

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: HR_USER, employeeId: null, role: 'HR_MANAGER', email: 'siti.nurhaliza@eperformiq.co.id' })}`;
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: EMP_USER, employeeId: 'b0000000-0000-4000-8000-000000000004', role: 'EMPLOYEE', email: 'budi.pratama@eperformiq.co.id' })}`;

    const ref = await (await listPlans(getReq('/x', hrCookie))).json();
    const departments: Array<{ id: string; name: string }> = ref.data.departments;
    const positions: Array<{ id: string; title: string; departmentId: string }> = ref.data.positions;
    const dept = departments.find((d) => positions.some((p) => p.departmentId === d.id));
    deptId = dept!.id;
    posId = positions.find((p) => p.departmentId === deptId)!.id;
    seedPlanId = ref.data.plans[0].id;
  });

  it('401 tanpa sesi', async () => {
    expect((await listPlans(getReq('/x'))).status).toBe(401);
  });

  it('EMPLOYEE tidak boleh membaca MPP (403)', async () => {
    expect((await listPlans(getReq('/x', empCookie))).status).toBe(403);
  });

  it('GET (HR) mengembalikan plans + referensi departemen/posisi', async () => {
    const res = await listPlans(getReq('/x', hrCookie));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.data.plans.length).toBeGreaterThanOrEqual(3);
    expect(j.data.departments.length).toBeGreaterThanOrEqual(1);
    expect(j.data.positions.length).toBeGreaterThanOrEqual(1);
    // bentuk data kuota/budget lengkap
    const p = j.data.plans[0];
    expect(typeof p.approvedQuota).toBe('number');
    expect(typeof p.allocatedBudget).toBe('number');
    expect(typeof p.remainingQuota).toBe('number');
  });

  it('EMPLOYEE tidak boleh menambah MPP (403)', async () => {
    const res = await createPlan(req('/x', 'POST', {}, empCookie));
    expect(res.status).toBe(403);
  });

  it('POST menambah MPP (HR) → 201', async () => {
    const res = await createPlan(req('/x', 'POST', {
      departmentId: deptId, positionId: posId, fiscalYear: 2030,
      approvedQuota: 7, allocatedBudget: 700000000, utilizedBudget: 0, hiredCount: 0,
    }, hrCookie));
    expect(res.status).toBe(201);
    createdId = (await res.json()).data.id;
    expect(createdId).toBeTruthy();
  });

  it('POST duplikat (dept, posisi, tahun sama) → 409', async () => {
    const res = await createPlan(req('/x', 'POST', {
      departmentId: deptId, positionId: posId, fiscalYear: 2030,
      approvedQuota: 3, allocatedBudget: 100000000,
    }, hrCookie));
    expect(res.status).toBe(409);
  });

  it('PATCH ubah kuota & budget → tercermin di GET', async () => {
    const res = await patchPlan(req('/x', 'PATCH', { approvedQuota: 9, allocatedBudget: 900000000, hiredCount: 2 }, hrCookie), { params: { id: createdId } });
    expect(res.status).toBe(200);
    const j = await (await listPlans(getReq('/x?fiscalYear=2030', hrCookie))).json();
    const row = j.data.plans.find((p: any) => p.id === createdId);
    expect(row.approvedQuota).toBe(9);
    expect(row.allocatedBudget).toBe(900000000);
    expect(row.remainingQuota).toBe(7);
  });

  it('PATCH id tak ada → 404', async () => {
    const res = await patchPlan(req('/x', 'PATCH', { approvedQuota: 1 }, hrCookie), { params: { id: '00000000-0000-4000-8000-000000000000' } });
    expect(res.status).toBe(404);
  });

  it('DELETE MPP yang masih dirujuk (seed) → 409', async () => {
    const res = await deletePlan(getReq('/x', hrCookie), { params: { id: seedPlanId } });
    expect(res.status).toBe(409);
  });

  it('DELETE MPP baru → 200, lalu 404 saat diulang', async () => {
    const res = await deletePlan(getReq('/x', hrCookie), { params: { id: createdId } });
    expect(res.status).toBe(200);
    const again = await deletePlan(getReq('/x', hrCookie), { params: { id: createdId } });
    expect(again.status).toBe(404);
  });
});
