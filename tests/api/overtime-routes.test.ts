import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import type { SqlClient } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getMine, POST as postRequest } from '@/app/api/v1/me/overtime-requests/route';
import { PUT as putApprove } from '@/app/api/v1/me/overtime-requests/[id]/approve/route';

const MGR_USER = 'e0000000-0000-4000-8000-000000000002';
const MGR_EMPLOYEE = 'b0000000-0000-4000-8000-000000000002';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const plusDays = (n: number) => {
  const d = new Date(`${today()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Hari kerja berikutnya (Sen–Jum) — batas 4 jam hanya berlaku di hari kerja. */
const nextWorkday = () => {
  for (let i = 1; i <= 7; i++) {
    const d = plusDays(i);
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (dow !== 0 && dow !== 6) return d;
  }
  return plusDays(1);
};

const jsonReq = (path: string, method: string, body: unknown, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: new Headers({ 'Content-Type': 'application/json', cookie }),
    body: JSON.stringify(body),
  });
const getReq = (path: string, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: new Headers({ cookie }) });

describe('overtime routes', () => {
  let client: SqlClient;
  let empCookie = '';
  let mgrCookie = '';
  let overtimeId = '';

  beforeAll(async () => {
    client = await getDb();
    await runSeed(client);

    const stamp = Date.now();
    const emp = await client.query<{ id: string }>(
      `INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
       VALUES (gen_random_uuid(), $1, 'Lembur Uji', $2,
               'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
               'PERMANENT', 8000000, CURRENT_DATE)
       RETURNING id`,
      [`OT-${stamp}`, `ot.${stamp}@eperformiq.co.id`],
    );
    const employeeId = emp.rows[0].id;

    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: `u-ot-${stamp}`, employeeId, role: 'EMPLOYEE', email: `ot.${stamp}@eperformiq.co.id` })}`;
    mgrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: MGR_USER, employeeId: MGR_EMPLOYEE, role: 'PEOPLE_MANAGER', email: 'mgr@eperformiq.co.id' })}`;
  });

  it('menolak lembur untuk tanggal yang sudah lewat', async () => {
    const res = await postRequest(jsonReq('/api/v1/me/overtime-requests', 'POST', {
      workDate: '2020-01-01', plannedHours: 2, reason: 'penyelesaian laporan',
    }, empCookie));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('menolak rencana lebih dari 4 jam pada hari kerja', async () => {
    const res = await postRequest(jsonReq('/api/v1/me/overtime-requests', 'POST', {
      workDate: nextWorkday(), plannedHours: 5, reason: 'penyelesaian laporan',
    }, empCookie));
    expect(res.status).toBe(422);
  });

  it('menolak rencana lebih dari 10 jam pada hari libur', async () => {
    // Cari hari Sabtu/Minggu terdekat.
    let restDay = '';
    for (let i = 1; i <= 7; i++) {
      const d = plusDays(i);
      const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
      if (dow === 0 || dow === 6) { restDay = d; break; }
    }
    const res = await postRequest(jsonReq('/api/v1/me/overtime-requests', 'POST', {
      workDate: restDay, plannedHours: 11, reason: 'persiapan audit tahunan',
    }, empCookie));
    expect(res.status).toBe(400);
  });

  it('mengajukan lembur → SUBMITTED', async () => {
    const res = await postRequest(jsonReq('/api/v1/me/overtime-requests', 'POST', {
      workDate: plusDays(1), plannedHours: 2, reason: 'penyelesaian laporan bulanan',
    }, empCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('SUBMITTED');
    overtimeId = json.data.id;
  });

  it('pengajuan ganda pada tanggal yang sama ditolak', async () => {
    const res = await postRequest(jsonReq('/api/v1/me/overtime-requests', 'POST', {
      workDate: plusDays(1), plannedHours: 1, reason: 'pengajuan kedua',
    }, empCookie));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('karyawan tidak boleh menyetujui lemburnya sendiri', async () => {
    const res = await putApprove(
      jsonReq(`/api/v1/me/overtime-requests/${overtimeId}/approve`, 'PUT', { decision: 'APPROVED' }, empCookie),
      { params: { id: overtimeId } } as any,
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('atasan menyetujui → APPROVED dan approver tercatat', async () => {
    const res = await putApprove(
      jsonReq(`/api/v1/me/overtime-requests/${overtimeId}/approve`, 'PUT', { decision: 'APPROVED' }, mgrCookie),
      { params: { id: overtimeId } } as any,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('APPROVED');
    expect(json.data.approvedBy).toBe(MGR_USER);
  });

  it('keputusan kedua ditolak', async () => {
    const res = await putApprove(
      jsonReq(`/api/v1/me/overtime-requests/${overtimeId}/approve`, 'PUT', { decision: 'REJECTED', reason: 'ubah pikiran' }, mgrCookie),
      { params: { id: overtimeId } } as any,
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('penolakan wajib beralasan', async () => {
    const created = await postRequest(jsonReq('/api/v1/me/overtime-requests', 'POST', {
      workDate: plusDays(2), plannedHours: 1, reason: 'lembur lain',
    }, empCookie));
    const id = (await created.json()).data.id;

    const res = await putApprove(
      jsonReq(`/api/v1/me/overtime-requests/${id}/approve`, 'PUT', { decision: 'REJECTED' }, mgrCookie),
      { params: { id } } as any,
    );
    expect(res.status).toBe(422);
  });

  it('karyawan melihat daftar lemburnya', async () => {
    const res = await getMine(getReq('/api/v1/me/overtime-requests', empCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.items.some((i: any) => i.id === overtimeId)).toBe(true);
  });
});
