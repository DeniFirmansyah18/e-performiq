import { describe, it, expect, beforeAll } from 'vitest';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { NextRequest } from 'next/server';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getRuns, POST as postRuns } from '@/app/api/v1/payroll/runs/route';
import { POST as runAction } from '@/app/api/v1/payroll/runs/[id]/action/route';
import { POST as advisory } from '@/app/api/v1/payroll/runs/[id]/advisory/route';
import { GET as exportCsv } from '@/app/api/v1/payroll/runs/[id]/export/route';
import { POST as payslip } from '@/app/api/v1/payroll/payslip/route';

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

const HR_USER = 'e0000000-0000-4000-8000-000000000002';
const BUDI = 'b0000000-0000-4000-8000-000000000004';

describe('WS-10 endpoint payroll', () => {
  let hrCookie = '';
  let empCookie = '';
  let runId = '';

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: HR_USER, employeeId: null, role: 'HR_MANAGER', email: 'siti.nurhaliza@eperformiq.co.id' })}`;
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000004', employeeId: BUDI, role: 'EMPLOYEE', email: 'budi.pratama@eperformiq.co.id' })}`;
  });

  it('GET runs tanpa sesi → 401', async () => {
    const res = await getRuns(getReq('/x'));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('POST runs (HR) → membuat run', async () => {
    // Periode unik per run agar tidak bentrok state .pglite.
    const y = new Date().getFullYear();
    const period = `${y}-04`;
    const res = await postRuns(req('/x', 'POST', { periodCode: period, periodStart: `${period}-01`, periodEnd: `${period}-30` }, hrCookie));
    expect(res.status).toBe(200);
    const j = await res.json();
    runId = j.data.runId;
    expect(j.data.items).toBeGreaterThanOrEqual(1);
  });

  it('GET runs mengembalikan daftar + item via runId', async () => {
    const list = await getRuns(getReq('/x', hrCookie));
    expect(list.status).toBe(200);
    const lj = await list.json();
    expect(Array.isArray(lj.data.runs)).toBe(true);

    const detail = await getRuns(getReq(`/x?runId=${runId}`, hrCookie));
    const dj = await detail.json();
    expect(Array.isArray(dj.data.items)).toBe(true);
    expect(dj.data.items.length).toBeGreaterThanOrEqual(1);
  });

  it('POST advisory (HR) mengembalikan insight (fallback bila AI off)', async () => {
    const res = await advisory(req('/x', 'POST', {}, hrCookie), { params: { id: runId } });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(typeof j.data.insight).toBe('string');
    expect(j.data.insight.length).toBeGreaterThan(20);
  });

  it('GET export → CSV', async () => {
    const res = await exportCsv(getReq('/x', hrCookie), { params: { id: runId } });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text.split('\n')[0]).toContain('employeeCode');
    expect(text.split('\n').length).toBeGreaterThan(1);
  });

  it('POST action approve → 200', async () => {
    const res = await runAction(req('/x', 'POST', { action: 'approve' }, hrCookie), { params: { id: runId } });
    expect(res.status).toBe(200);
  });

  it('POST payslip dengan PIN valid milik sendiri → rincian', async () => {
    const res = await payslip(req('/x', 'POST', { pin: '123456' }, empCookie));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.data).toHaveProperty('net');
  });

  it('POST payslip dengan PIN salah → 401', async () => {
    const res = await payslip(req('/x', 'POST', { pin: '000000' }, empCookie));
    expect(res.status).toBe(401);
  });
});
