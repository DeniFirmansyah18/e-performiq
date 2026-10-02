import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { NextRequest } from 'next/server';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getOnboarding, POST as postOnboarding } from '@/app/api/v1/learning/onboarding/route';
import { POST as generateHr, GET as getHr } from '@/app/api/v1/recruitment/onboarding/generate/route';

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

const POS_SWE = 'a0000000-0000-4000-8000-000000000204';

// Route handler memakai singleton .pglite (dev). Kita siapkan data lewat client
// YANG SAMA (getDb) agar visibel bagi route.
describe('WS-8 endpoint onboarding', () => {
  let employeeId: string;
  let empCookie = '';
  let hrCookie = '';

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client); // pastikan skema+seed ada (idempoten)
    const code = `EMP-ONB-${Date.now()}`;
    const ins = await client.query<{ id: string }>(
      `INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
       VALUES (gen_random_uuid(), $1, 'Onboard Uji', $2,
               'a0000000-0000-4000-8000-000000000101'::uuid, $3::uuid, 'PROBATION', 12000000, CURRENT_DATE)
       RETURNING id`,
      [code, `${code.toLowerCase()}@eperformiq.co.id`, POS_SWE],
    );
    employeeId = ins.rows[0].id;
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000004', employeeId, role: 'EMPLOYEE', email: 'onboard.uji@eperformiq.co.id' })}`;
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000002', employeeId: null, role: 'HR_MANAGER', email: 'siti.nurhaliza@eperformiq.co.id' })}`;
  });
  afterAll(async () => { /* biarkan singleton hidup untuk file test lain */ });

  it('GET onboarding tanpa sesi → 401', async () => {
    const res = await getOnboarding(getReq('/x'));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('POST generate → program dibuat, enrolled > 0', async () => {
    const res = await postOnboarding(req('/x', 'POST', { action: 'generate' }, empCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.planId).toBeTruthy();
    expect(json.data.enrolled).toBeGreaterThanOrEqual(4);
  });

  it('GET onboarding mengembalikan 4 kursus wajib untuk SWE', async () => {
    const res = await getOnboarding(getReq('/x', empCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.totalMandatory).toBe(4);
    expect(json.data.items.length).toBe(4);
  });

  it('HR: POST generate untuk karyawan lain', async () => {
    const res = await generateHr(req('/x', 'POST', { employeeId }, hrCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.programId).toBeTruthy();
  });

  it('HR: GET status onboard karyawan → 200', async () => {
    const res = await getHr(getReq(`/x?employeeId=${employeeId}`, hrCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.employeeId).toBe(employeeId);
  });

  it('HR: tanpa employeeId → 400', async () => {
    const res = await getHr(getReq('/x', hrCookie));
    expect(res.status).toBe(400);
  });
});
