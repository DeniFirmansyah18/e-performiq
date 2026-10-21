import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import type { SqlClient } from '@/lib/db/client';
import { POST as postCorrection } from '@/app/api/v1/me/attendance-corrections/route';
import { PUT as putDecide } from '@/app/api/v1/attendance/corrections/[id]/decide/route';

const HR_USER = 'e0000000-0000-4000-8000-000000000001';

const jsonReq = (path: string, method: string, body: unknown, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: new Headers({ 'Content-Type': 'application/json', cookie }),
    body: JSON.stringify(body),
  });

describe('attendance corrections', () => {
  let client: SqlClient;
  let employeeId = '';
  let empCookie = '';
  let hrCookie = '';
  let logId = '';
  let correctionId = '';

  beforeAll(async () => {
    client = await getDb();
    await runSeed(client);

    const stamp = Date.now();
    const emp = await client.query<{ id: string }>(
      `INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
       VALUES (gen_random_uuid(), $1, 'Koreksi Uji', $2,
               'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
               'PERMANENT', 8000000, CURRENT_DATE)
       RETURNING id`,
      [`CORR-${stamp}`, `corr.${stamp}@eperformiq.co.id`],
    );
    employeeId = emp.rows[0].id;

    const log = await client.query<{ id: string }>(
      `INSERT INTO attendance_logs (employee_id, work_date, check_in_at, work_mode)
       VALUES ($1::uuid, CURRENT_DATE, CURRENT_TIMESTAMP - INTERVAL '1 hour', 'WFH')
       RETURNING id`,
      [employeeId],
    );
    logId = log.rows[0].id;

    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: `u-${stamp}`, employeeId, role: 'EMPLOYEE', email: `corr.${stamp}@eperformiq.co.id` })}`;
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: HR_USER, employeeId: 'b0000000-0000-4000-8000-000000000001', role: 'HR_MANAGER', email: 'hr@eperformiq.co.id' })}`;
  });

  it('menolak koreksi tanpa jam pengganti', async () => {
    const res = await postCorrection(jsonReq('/api/v1/me/attendance-corrections', 'POST', {
      attendanceLogId: logId, reason: 'mesin absen error',
    }, empCookie));
    expect(res.status).toBe(400);
  });

  it('mengajukan koreksi jam masuk', async () => {
    const res = await postCorrection(jsonReq('/api/v1/me/attendance-corrections', 'POST', {
      attendanceLogId: logId, requestedCheckInAt: '2026-10-21T07:55:00+07:00', reason: 'mesin absen error',
    }, empCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('SUBMITTED');
    correctionId = json.data.id;
  });

  it('data mesin asli tidak berubah sebelum disetujui', async () => {
    const before = await client.query<{ check_in_at: string; work_mode: string }>(
      `SELECT check_in_at, work_mode FROM attendance_logs WHERE id = $1::uuid`, [logId],
    );
    expect(before.rows[0].check_in_at).not.toBeNull();
    expect(before.rows[0].work_mode).toBe('WFH');
  });

  it('HR menyetujui koreksi dan jam diterapkan', async () => {
    const res = await putDecide(
      jsonReq(`/api/v1/attendance/corrections/${correctionId}/decide`, 'PUT', { decision: 'APPROVED', note: 'sesuai log mesin' }, hrCookie),
      { params: { id: correctionId } } as any,
    );
    expect(res.status).toBe(200);

    const after = await client.query<{ check_in_at: string }>(
      `SELECT check_in_at FROM attendance_logs WHERE id = $1::uuid`, [logId],
    );
    expect(new Date(after.rows[0].check_in_at).toISOString()).toBe('2026-10-21T00:55:00.000Z');
  });

  it('keputusan kedua ditolak', async () => {
    const res = await putDecide(
      jsonReq(`/api/v1/attendance/corrections/${correctionId}/decide`, 'PUT', { decision: 'REJECTED' }, hrCookie),
      { params: { id: correctionId } } as any,
    );
    expect(res.status).toBe(422);
  });

  it('karyawan tidak boleh memutuskan koreksinya sendiri', async () => {
    const own = await postCorrection(jsonReq('/api/v1/me/attendance-corrections', 'POST', {
      attendanceLogId: logId, requestedCheckInAt: '2026-10-21T08:05:00+07:00', reason: 'koreksi kedua',
    }, empCookie));
    const id = (await own.json()).data.id;

    const res = await putDecide(
      jsonReq(`/api/v1/attendance/corrections/${id}/decide`, 'PUT', { decision: 'APPROVED' }, empCookie),
      { params: { id } } as any,
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
