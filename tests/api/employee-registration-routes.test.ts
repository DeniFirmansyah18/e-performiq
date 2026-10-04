import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { POST as register } from '@/app/api/v1/employee/register/route';
import { GET as verify } from '@/app/api/v1/employee/verify/route';
import { GET as listRegs } from '@/app/api/v1/hr/registrations/route';
import { POST as approveReg } from '@/app/api/v1/hr/registrations/[id]/approve/route';
import { POST as rejectReg } from '@/app/api/v1/hr/registrations/[id]/reject/route';

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/v1/employee/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Route memakai singleton .pglite (dev). Siapkan seed via client yang sama
// agar visibel bagi route (pola tests/api/attendance-routes.test.ts).
const HR_USER = 'e0000000-0000-4000-8000-000000000002';

function hrReq(path: string, method: string, body: unknown, cookie: string): NextRequest {
  const headers = new Headers();
  if (body) headers.set('Content-Type', 'application/json');
  headers.set('cookie', cookie);
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function getReq(path: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers });
}

describe('WS-2 rute registrasi karyawan', () => {
  let hrCookie = '';

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: HR_USER, employeeId: null, role: 'HR_MANAGER', email: 'siti.nurhaliza@eperformiq.co.id' })}`;
  });

  it('register 200 + PENDING_EMAIL', async () => {
    const email = `route.user.${Date.now()}@example.com`;
    const res = await register(
      post({ fullName: 'Route User', email, password: 'rahasia123' }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe('PENDING_EMAIL');
  });

  it('register email invalid → 4xx', async () => {
    const res = await register(
      post({ fullName: 'X', email: 'bukan-email', password: 'rahasia123' }),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('register → verify roundtrip ok', async () => {
    const email = `route.verify.${Date.now()}@example.com`;
    const reg = await register(
      post({ fullName: 'Verif Route', email, password: 'rahasia123' }),
    );
    expect(reg.status).toBe(200);
    const client = await getDb();
    const q = await client.query<{ verify_token: string }>(
      `SELECT verify_token FROM employee_registrations WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email],
    );
    const token = q.rows[0]?.verify_token;
    expect(token).toBeTruthy();
    const req = new NextRequest(
      `http://localhost:3000/api/v1/employee/verify?token=${token}`,
    );
    const res = await verify(req);
    expect(res.status).toBe(200);
    expect((await res.json()).data.ok).toBe(true);
  });

  it('verify token asing → 4xx', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/v1/employee/verify?token=ngawur',
    );
    const res = await verify(req);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('HR list tanpa sesi → 401', async () => {
    const res = await listRegs(getReq('/api/v1/hr/registrations'));
    expect(res.status).toBe(401);
  });

  it('HR list (HR) → items array', async () => {
    const email = `hr.list.${Date.now()}@example.com`;
    const reg = await register(post({ fullName: 'List User', email, password: 'rahasia123' }));
    expect(reg.status).toBe(200);
    const res = await listRegs(getReq('/api/v1/hr/registrations', hrCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data.items)).toBe(true);
    expect(json.data.items.some((r: any) => r.email === email)).toBe(true);
  });

  it('HR approve → user+employee, idempotent', async () => {
    const email = `hr.approve.${Date.now()}@example.com`;
    expect((await register(post({ fullName: 'Approve Route', email, password: 'rahasia123' }))).status).toBe(200);
    const client = await getDb();
    const q = await client.query<{ verify_token: string }>(
      `SELECT verify_token FROM employee_registrations WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email],
    );
    await verify(new NextRequest(`http://localhost:3000/api/v1/employee/verify?token=${q.rows[0].verify_token}`));
    const list = await (await listRegs(getReq('/api/v1/hr/registrations', hrCookie))).json();
    const regId = (list.data.items as any[]).find((r) => r.email === email)!.id as string;
    const dept = (await client.query<{ id: string }>(`SELECT id FROM departments LIMIT 1`)).rows[0].id;
    const posQ = await client.query<{ id: string }>(`SELECT id FROM job_positions LIMIT 1`);
    const pos = posQ.rows[0].id;
    const first = await approveReg(hrReq('/x', 'POST', { departmentId: dept, positionId: pos }, hrCookie), { params: { id: regId } });
    expect(first.status).toBe(200);
    const fj = await first.json();
    expect(fj.data.userId).toBeTruthy();
    expect(fj.data.employeeId).toBeTruthy();
    const second = await approveReg(hrReq('/x', 'POST', { departmentId: dept, positionId: pos }, hrCookie), { params: { id: regId } });
    expect(second.status).toBe(200);
    expect((await second.json()).data.userId).toBe(fj.data.userId);
    const n = await client.query<{ c: string }>(
      `SELECT COUNT(*)::text c FROM users WHERE LOWER(email) = LOWER($1)`, [email],
    );
    expect(n.rows[0].c).toBe('1');
  });

  it('HR reject → REJECTED', async () => {
    const email = `hr.reject.${Date.now()}@example.com`;
    expect((await register(post({ fullName: 'Reject Route', email, password: 'rahasia123' }))).status).toBe(200);
    const client = await getDb();
    const list = await (await listRegs(getReq('/api/v1/hr/registrations', hrCookie))).json();
    const regId = (list.data.items as any[]).find((r) => r.email === email)!.id as string;
    const res = await rejectReg(hrReq('/x', 'POST', { reason: 'bukan karyawan' }, hrCookie), { params: { id: regId } });
    expect(res.status).toBe(200);
    const row = await client.query<{ status: string }>(
      `SELECT status FROM employee_registrations WHERE id = $1::uuid`, [regId],
    );
    expect(row.rows[0].status).toBe('REJECTED');
  });
});
