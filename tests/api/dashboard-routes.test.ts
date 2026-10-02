import { describe, it, expect, beforeAll } from 'vitest';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { NextRequest } from 'next/server';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getHrDash } from '@/app/api/v1/dashboard/hr/route';
import { GET as getPe } from '@/app/api/v1/dashboard/post-employment/route';

function getReq(path: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers });
}

const HR_USER = 'e0000000-0000-4000-8000-000000000002';
const BUDI = 'b0000000-0000-4000-8000-000000000004';

describe('WS-11 endpoint dashboard', () => {
  let hrCookie = '';
  let empCookie = '';

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: HR_USER, employeeId: null, role: 'HR_MANAGER', email: 'siti.nurhaliza@eperformiq.co.id' })}`;
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000004', employeeId: BUDI, role: 'EMPLOYEE', email: 'budi.pratama@eperformiq.co.id' })}`;
  });

  it('GET /dashboard/hr tanpa sesi → 401', async () => {
    const res = await getHrDash(getReq('/api/v1/dashboard/hr'));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('GET /dashboard/hr (HR) → semua blok agregasi', async () => {
    const res = await getHrDash(getReq('/api/v1/dashboard/hr', hrCookie));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.data.workforce.total).toBeGreaterThanOrEqual(1);
    expect(j.data).toHaveProperty('recruitment');
    expect(j.data).toHaveProperty('postEmployment');
  });

  it('GET /dashboard/hr (EMPLOYEE) → 403', async () => {
    const res = await getHrDash(getReq('/api/v1/dashboard/hr', empCookie));
    expect(res.status).toBe(403);
  });

  it('GET /dashboard/hr?manager=1 (EMPLOYEE) → ringkasan manager', async () => {
    const res = await getHrDash(getReq('/api/v1/dashboard/hr?manager=1', empCookie));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.data).toHaveProperty('team');
    expect(j.data).toHaveProperty('approvals');
  });

  it('GET /dashboard/post-employment (HR) → exit + cuti + LCI', async () => {
    const res = await getPe(getReq('/api/v1/dashboard/post-employment', hrCookie));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(Array.isArray(j.data.offboardings)).toBe(true);
    expect(j.data).toHaveProperty('leave');
    expect(j.data).toHaveProperty('lifetimeContributions');
  });
});
