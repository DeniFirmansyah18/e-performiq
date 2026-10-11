import { describe, it, expect, beforeAll } from 'vitest';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { NextRequest } from 'next/server';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getLeaves, POST as postLeave } from '@/app/api/v1/governance/leaves/route';
import { PATCH as patchLeave } from '@/app/api/v1/governance/leaves/[id]/route';

function req(path: string, method: string, body: unknown, cookie?: string): NextRequest {
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
function patchReq(path: string, body: unknown, cookie?: string): NextRequest {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest(`http://localhost:3000${path}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
}

// Fase POST-employment: pengajuan cuti self-service + antrean approval HR.
describe('Governance leaves (ajukan → antrean → keputusan)', () => {
  let employeeId: string;
  let empCookie = '';
  let hrCookie = '';
  let leaveId = '';

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    const ins = await client.query<{ id: string }>(
      `INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
       VALUES (gen_random_uuid(), $1, 'Cuti Uji', $2,
               'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
               'PERMANENT', 8000000, CURRENT_DATE)
       RETURNING id`,
      [`CUTI-${Date.now()}`, `cuti.${Date.now()}@eperformiq.co.id`],
    );
    employeeId = ins.rows[0].id;
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000004', employeeId, role: 'EMPLOYEE', email: 'cuti.uji@eperformiq.co.id' })}`;
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000001', employeeId: 'b0000000-0000-4000-8000-000000000001', role: 'HR_MANAGER', email: 'hr@eperformiq.co.id' })}`;
  });

  it('POST tanpa sesi → 401', async () => {
    const res = await postLeave(req('/x', 'POST', { leaveType: 'ANNUAL', startDate: '2031-06-01', endDate: '2031-06-02', totalDays: 2, reason: 'liburan keluarga' }));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('POST cuti valid → SUBMITTED', async () => {
    const res = await postLeave(req('/x', 'POST', {
      leaveType: 'ANNUAL', startDate: '2031-06-01', endDate: '2031-06-02', totalDays: 2, reason: 'liburan keluarga',
    }, empCookie));
    expect(res.status).toBe(200);

    const mine = await getLeaves(getReq('/x?scope=mine', empCookie));
    const json = await mine.json();
    const items = json.data.items as Array<{ id: string; status: string }>;
    expect(items.length).toBeGreaterThanOrEqual(1);
    leaveId = items[0].id;
    expect(items[0].status).toBe('SUBMITTED');
  });

  it('GET pending tanpa izin approve → ditolak', async () => {
    const res = await getLeaves(getReq('/x?scope=pending', empCookie));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('GET pending sebagai HR → memuat antrean', async () => {
    const res = await getLeaves(getReq('/x?scope=pending', hrCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    const items = json.data.items as Array<{ id: string }>;
    expect(items.some((i) => i.id === leaveId)).toBe(true);
  });

  it('PATCH approve → APPROVED', async () => {
    const res = await patchLeave(patchReq(`/x/${leaveId}`, { decision: 'APPROVED' }, hrCookie), { params: { id: leaveId } } as any);
    expect(res.status).toBe(200);

    const mine = await getLeaves(getReq('/x?scope=mine', empCookie));
    const json = await mine.json();
    const items = json.data.items as Array<{ id: string; status: string }>;
    expect(items.find((i) => i.id === leaveId)?.status).toBe('APPROVED');
  });
});
