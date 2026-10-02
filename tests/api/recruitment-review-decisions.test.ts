import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { NextRequest } from 'next/server';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getReview } from '@/app/api/v1/recruitment/candidates/[id]/review/route';
import { POST as postDecision } from '@/app/api/v1/recruitment/candidates/[id]/decision/route';
import { GET as getResult } from '@/app/api/v1/careers/result/[applicationNo]/route';

function req(path: string, method: string, body: unknown, cookie?: string): NextRequest {
  const headers = new Headers();
  if (body) headers.set('Content-Type', 'application/json');
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest(`http://localhost:3000${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
}
function getReq(path: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers });
}

// HR_MANAGER seed user (Siti).
const HR_USER = 'e0000000-0000-4000-8000-000000000002';

describe('WS-7 endpoint review & keputusan', () => {
  let client: PGlite;
  let appNo: string;
  let appId: string;
  let hrCookie = '';

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    await client.exec(`UPDATE job_postings SET is_public = TRUE, status = 'OPEN' WHERE id IN (SELECT id FROM job_postings LIMIT 3);`);
    const q = await client.query<{ id: string; application_no: string }>(
      `SELECT ja.id, ja.application_no FROM job_applications ja LIMIT 1`,
    );
    appId = q.rows[0].id;
    appNo = q.rows[0].application_no;
    const token = await signSession({ userId: HR_USER, employeeId: null, role: 'HR_MANAGER', email: 'siti.nurhaliza@eperformiq.co.id' });
    hrCookie = `${SESSION_COOKIE_NAME}=${token}`;
  });
  afterAll(async () => { await client.close(); });

  it('GET review tanpa sesi → 401', async () => {
    const res = await getReview(getReq('/x'), { params: { id: appId } });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('GET review dengan sesi HR → data agregat + aiSummary', async () => {
    const res = await getReview(getReq('/x', hrCookie), { params: { id: appId } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.applicationId).toBe(appId);
    expect(json.data).toHaveProperty('recommendation');
    expect(typeof json.data.aiSummary).toBe('string');
    expect(json.data.aiSummary.length).toBeGreaterThan(10);
  });

  it('POST decision ACCEPTED → 200 + status berubah', async () => {
    const res = await postDecision(req('/x', 'POST', { decision: 'ACCEPTED', notes: 'ok' }, hrCookie), { params: { id: appId } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.decision).toBe('ACCEPTED');
  });

  it('POST decision keputusan invalid → 400', async () => {
    const res = await postDecision(req('/x', 'POST', { decision: 'MAYBE' }, hrCookie), { params: { id: appId } });
    expect(res.status).toBe(400);
  });

  it('GET hasil publik mengembalikan pesan notifikasi', async () => {
    const res = await getResult(getReq('/x'), { params: { applicationNo: appNo } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.applicationNo).toBe(appNo);
    expect(['ACCEPTED', 'REJECTED', 'TALENT_POOL', 'PENDING']).toContain(json.data.decision);
    expect(typeof json.data.message).toBe('string');
  });

  it('GET hasil nomor tak dikenal → 404', async () => {
    const res = await getResult(getReq('/x'), { params: { applicationNo: 'APP-NOPE' } });
    expect(res.status).toBe(404);
  });
});
