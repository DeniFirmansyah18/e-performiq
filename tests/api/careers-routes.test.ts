import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { signSession } from '@/lib/auth/session';
import { NextRequest } from 'next/server';
import { GET as postingsGet } from '@/app/api/v1/careers/postings/route';
import { POST as applyPost } from '@/app/api/v1/careers/apply/route';
import { GET as statusGet } from '@/app/api/v1/careers/status/[applicationNo]/route';
import { GET as verifyGet } from '@/app/api/v1/certificates/verify/[code]/route';
import { GET as candidatesGet } from '@/app/api/v1/recruitment/candidates/route';

const HR_USER = 'e0000000-0000-4000-8000-000000000002';
const HR_EMP = 'b0000000-0000-4000-8000-000000000002';

function req(path: string, token?: string, body?: unknown): NextRequest {
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (body) headers.set('Content-Type', 'application/json');
  return new NextRequest(`http://localhost:3000${path}`, {
    method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined,
  });
}

describe('public careers + HR routes', () => {
  let client: PGlite;
  beforeAll(async () => { ({ client } = await createTestDb()); await runSeed(client); });
  afterAll(async () => { await client.close(); });

  it('GET /careers/postings publik (tanpa sesi)', async () => {
    const res = await postingsGet(req('/x'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data.postings)).toBe(true);
    expect(json.data.postings.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /careers/apply membuat nomor lamaran; honeypot ditolak', async () => {
    const postings = await postingsGet(req('/x'));
    const pid = (await postings.json()).data.postings[0].id;
    const ok = await applyPost(req('/x', undefined, {
      fullName: 'Kandidat Uji', email: 'kandidat.uji@example.com', jobPostingId: pid, resumeUrl: 'https://x/cv.pdf', coverLetter: 'Halo',
    }));
    expect(ok.status).toBe(200);
    const j = await ok.json();
    expect(j.data.applicationNo).toMatch(/^APP-/);
    const honeypot = await applyPost(req('/x', undefined, {
      fullName: 'Spam', email: 'spam@example.com', jobPostingId: pid, website: 'x',
    }));
    expect(honeypot.status).toBe(400);
  });

  it('GET /careers/status/:no -> 404 untuk nomor tak dikenal', async () => {
    const res = await statusGet(req('/x'), { params: { applicationNo: 'APP-TIDAKADA' } });
    expect(res.status).toBe(404);
  });

  it('GET /certificates/verify/:code -> 404 untuk kode tak dikenal', async () => {
    const res = await verifyGet(req('/x'), { params: { code: 'NOPE' } });
    expect(res.status).toBe(404);
  });

  it('GET /recruitment/candidates 401 tanpa sesi; 200 dengan HR', async () => {
    const noauth = await candidatesGet(req('/x'));
    expect(noauth.status).toBe(401);
    const token = await signSession({ userId: HR_USER, employeeId: HR_EMP, role: 'HR_MANAGER', email: 'siti@x.id' });
    const ok = await candidatesGet(req('/x', token));
    expect(ok.status).toBe(200);
  });
});
