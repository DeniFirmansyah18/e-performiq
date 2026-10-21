import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getMine } from '@/app/api/v1/me/employment-status/route';
import { PUT as putStatus } from '@/app/api/v1/hr/employees/[id]/employment-status/route';

const HR_USER = 'e0000000-0000-4000-8000-000000000001';

const getReq = (path: string, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: new Headers({ cookie }) });

const putReq = (path: string, body: unknown, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: 'PUT',
    headers: new Headers({ 'Content-Type': 'application/json', cookie }),
    body: JSON.stringify(body),
  });

describe('employment status routes', () => {
  let employeeId = '';
  let empCookie = '';
  let hrCookie = '';

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);

    // Fixture sendiri: tes route berbagi .pglite dev, jadi jangan mengubah karyawan seed.
    const stamp = Date.now();
    const ins = await client.query<{ id: string }>(
      `INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
       VALUES (gen_random_uuid(), $1, 'Status Uji', $2,
               'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
               'PERMANENT', 8000000, CURRENT_DATE)
       RETURNING id`,
      [`STATUS-${stamp}`, `status.${stamp}@eperformiq.co.id`],
    );
    employeeId = ins.rows[0].id;

    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: `u-${stamp}`, employeeId, role: 'EMPLOYEE', email: `status.${stamp}@eperformiq.co.id` })}`;
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: HR_USER, employeeId: 'b0000000-0000-4000-8000-000000000001', role: 'HR_MANAGER', email: 'hr@eperformiq.co.id' })}`;
  });

  it('karyawan membaca statusnya sendiri', async () => {
    const res = await getMine(getReq('/api/v1/me/employment-status', empCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('PROBATION');
  });

  it('karyawan tidak boleh mengubah status', async () => {
    const res = await putStatus(
      putReq(`/api/v1/hr/employees/${employeeId}/employment-status`,
        { newStatus: 'TETAP', effectiveDate: '2026-10-21', reason: 'pengangkatan' }, empCookie),
      { params: { id: employeeId } } as any,
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('HR mengubah ke TETAP dan riwayat tercatat', async () => {
    const res = await putStatus(
      putReq(`/api/v1/hr/employees/${employeeId}/employment-status`,
        { newStatus: 'TETAP', effectiveDate: '2026-10-21', reason: 'pengangkatan' }, hrCookie),
      { params: { id: employeeId } } as any,
    );
    expect(res.status).toBe(200);

    const mine = await getMine(getReq('/api/v1/me/employment-status', empCookie));
    const json = await mine.json();
    expect(json.data.status).toBe('TETAP');
    expect(String(json.data.appointmentDate).slice(0, 10)).toBe('2026-10-21');
    expect(json.data.history.length).toBeGreaterThanOrEqual(1);
  });

  it('perubahan ke status yang sama ditolak', async () => {
    const res = await putStatus(
      putReq(`/api/v1/hr/employees/${employeeId}/employment-status`,
        { newStatus: 'TETAP', effectiveDate: '2026-10-22', reason: 'pengangkatan ulang' }, hrCookie),
      { params: { id: employeeId } } as any,
    );
    expect(res.status).toBe(422);
  });
});
