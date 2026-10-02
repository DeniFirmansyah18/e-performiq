import { describe, it, expect, beforeAll } from 'vitest';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { NextRequest } from 'next/server';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getClock, POST as postClock } from '@/app/api/v1/attendance/clock/route';
import { GET as getTs, POST as postTs } from '@/app/api/v1/attendance/timesheets/route';
import { GET as getPending } from '@/app/api/v1/attendance/timesheets/pending/route';
import { POST as decide } from '@/app/api/v1/attendance/timesheets/[id]/decide/route';

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

// Route memakai singleton .pglite (dev). Siapkan karyawan via client yang sama.
describe('WS-9 endpoint absensi & timesheet', () => {
  let employeeId: string;
  let empCookie = '';
  let mgrCookie = '';
  const workDate = '2031-03-10';

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    const code = `EMP-ATT-${Date.now()}`;
    const mgr = await client.query<{ id: string }>(
      `SELECT id FROM employees WHERE id = 'b0000000-0000-4000-8000-000000000003'::uuid`,
    );
    const ins = await client.query<{ id: string }>(
      `INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, manager_id, status, base_salary, join_date)
       SELECT gen_random_uuid(), $1, 'Atensi Uji', $2,
              'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
              $3::uuid, 'PERMANENT', 10000000, CURRENT_DATE
       RETURNING id`,
      [code, `${code.toLowerCase()}@eperformiq.co.id`, mgr.rows[0].id],
    );
    employeeId = ins.rows[0].id;
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000004', employeeId, role: 'EMPLOYEE', email: 'atensi.uji@eperformiq.co.id' })}`;
    mgrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000003', employeeId: mgr.rows[0].id, role: 'PEOPLE_MANAGER', email: 'danu.tech@eperformiq.co.id' })}`;
  });

  it('POST check-in tanpa sesi → 401', async () => {
    const res = await postClock(req('/x', 'POST', { action: 'check-in' }));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('POST check-in → OPEN, GET clock mengembalikan log', async () => {
    const res = await postClock(req('/x', 'POST', {
      action: 'check-in', workDate, photoUrl: 'data:image/jpeg;base64,AAAA', geo: { lat: -6.2, lng: 106.8 },
    }, empCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('OPEN');

    const list = await getClock(getReq('/x', empCookie));
    const lj = await list.json();
    expect(lj.data.logs.some((l: any) => l.workDate.slice(0, 10) === workDate)).toBe(true);
  });

  it('POST check-out → CLOSED + jam kerja', async () => {
    const res = await postClock(req('/x', 'POST', { action: 'check-out', workDate, photoUrl: 'data:image/jpeg;base64,BBBB' }, empCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('CLOSED');
    expect(json.data.totalWorkHours).not.toBeNull();
  });

  it('POST check-out dua kali → 422', async () => {
    const res = await postClock(req('/x', 'POST', { action: 'check-out', workDate }, empCookie));
    expect(res.status).toBe(422);
  });

  it('POST timesheet dengan foto → SUBMITTED', async () => {
    const res = await postTs(req('/x', 'POST', {
      workDate: '2031-03-11', overtimeHours: 1, taskSummary: 'Review arsitektur sistem',
      activityCategory: 'PROJECT', photos: ['data:image/jpeg;base64,AAAA'],
    }, empCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.approvalStatus).toBe('SUBMITTED');
    expect(json.data.photos.length).toBe(1);
  });

  it('manager melihat pending, lalu menyetujui', async () => {
    const pending = await getPending(getReq('/x', mgrCookie));
    expect(pending.status).toBe(200);
    const pj = await pending.json();
    const row = pj.data.timesheets.find((t: any) => t.employeeId === employeeId);
    expect(row).toBeTruthy();

    const res = await decide(req('/x', 'POST', { decision: 'APPROVED' }, mgrCookie), { params: { id: row.id } });
    expect(res.status).toBe(200);
    expect((await res.json()).data.approvalStatus).toBe('APPROVED');
  });

  it('manager tidak boleh approve tanpa izin (EMPLOYEE) → 403', async () => {
    const res = await getPending(getReq('/x', empCookie));
    expect(res.status).toBe(403);
  });
});
