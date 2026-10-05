import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getMine, POST as postMine } from '@/app/api/v1/offboarding/me/route';
import { PATCH as patchHandover } from '@/app/api/v1/offboarding/me/handover/[id]/route';
import { POST as postExit } from '@/app/api/v1/offboarding/me/exit-interview/route';

// Karyawan seed (Budi Pratama).
const EMP_ID = 'b0000000-0000-4000-8000-000000000004';
const EMP_USER = 'e0000000-0000-4000-8000-000000000004';

function req(path: string, method: string, body: unknown, cookie: string): NextRequest {
  const headers = new Headers({ 'Content-Type': 'application/json', cookie });
  return new NextRequest(`http://localhost:3000${path}`, { method, headers, body: JSON.stringify(body) });
}
function getReq(path: string, cookie: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: { cookie } });
}

describe('WS-6 offboarding self-service (fase Setelah Kerja)', () => {
  let cookie = '';

  beforeAll(async () => {
    await runSeed(await getDb());
    cookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: EMP_USER, employeeId: EMP_ID, role: 'EMPLOYEE', email: 'budi.pratama@eperformiq.co.id' })}`;
    // Bersihkan state offboarding milik karyawan uji agar idempoten antar-run.
    const client = await getDb();
    await client.query(`DELETE FROM exit_interviews WHERE employee_id = $1::uuid`, [EMP_ID]);
    await client.query(`DELETE FROM knowledge_handovers WHERE offboarding_request_id IN (SELECT id FROM offboarding_requests WHERE employee_id = $1::uuid)`, [EMP_ID]);
    await client.query(`DELETE FROM severance_calculations WHERE offboarding_request_id IN (SELECT id FROM offboarding_requests WHERE employee_id = $1::uuid)`, [EMP_ID]);
    await client.query(`DELETE FROM offboarding_requests WHERE employee_id = $1::uuid`, [EMP_ID]);
  });

  it('GET /offboarding/me awalnya { request: null }', async () => {
    const res = await getMine(getReq('/x', cookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.request).toBeNull();
  });

  it('POST /offboarding/me membuat request dengan employee_id dari sesi (anti-spoof)', async () => {
    const res = await postMine(req('/x', 'POST', {
      reasonForLeaving: 'Resign',
      resignationNoticeDate: '2026-11-01',
      lastWorkingDay: '2026-12-01',
      employee_id: 'b0000000-0000-4000-8000-000000000001', // percobaan spoof — harus diabaikan
    }, cookie));
    expect(res.status).toBe(200);
    const client = await getDb();
    const row = await client.query<{ employee_id: string }>(
      `SELECT employee_id FROM offboarding_requests WHERE employee_id = $1::uuid ORDER BY created_at DESC LIMIT 1`, [EMP_ID]);
    expect(row.rows.length).toBe(1);
  });

  it('GET mengembalikan request + handovers', async () => {
    const res = await getMine(getReq('/x', cookie));
    const json = await res.json();
    expect(json.data.request).toBeTruthy();
    expect(Array.isArray(json.data.handovers)).toBe(true);
  });

  it('PATCH handover milik karyawan lain → 403/404', async () => {
    // Handover milik karyawan lain (buat request untuk karyawan lain via SQL).
    const client = await getDb();
    const otherEmp = 'b0000000-0000-4000-8000-000000000001';
    const otherReq = await client.query<{ id: string }>(
      `INSERT INTO offboarding_requests (employee_id, reason_for_leaving, resignation_notice_date, last_working_day)
       VALUES ($1::uuid, 'Resign', '2026-11-01', '2026-12-01') RETURNING id`, [otherEmp]);
    const reqId = otherReq.rows[0].id;
    const hv = await client.query<{ id: string }>(
      `INSERT INTO knowledge_handovers (offboarding_request_id, handover_item_name, category, handover_to_employee_id)
       VALUES ($1::uuid, 'Akun email', 'ACCESS_KEY', $2::uuid) RETURNING id`, [reqId, otherEmp]);
    const handoverId = hv.rows[0].id;
    const res = await patchHandover(req('/x', 'PATCH', {}, cookie), { params: { id: handoverId } });
    expect([403, 404]).toContain(res.status);
  });

  it('POST exit interview menyimpan feedback; GET menyertakannya', async () => {
    const res = await postExit(req('/x', 'POST', { feedback: 'Terima kasih.', overallRating: 5, wouldRecommend: true }, cookie));
    expect(res.status).toBe(200);
    const g = await getMine(getReq('/x', cookie));
    const json = await g.json();
    expect(json.data.exitInterview).toBeTruthy();
    expect(json.data.exitInterview.overallRating).toBe(5);
  });
});
