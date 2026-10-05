import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { POST as register } from '@/app/api/v1/careers/auth/register/route';
import { POST as apply } from '@/app/api/v1/careers/apply/route';
import { POST as startTest } from '@/app/api/v1/careers/assessments/start/route';

// Route memakai singleton .pglite (dev). Seed & query via client yang sama.
function jsonReq(path: string, body: unknown, cookie?: string): NextRequest {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest(`http://localhost:3000${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
}
function cookieOf(res: Response): string {
  return (res.headers.get('set-cookie') || '').split(';')[0];
}

describe('WS-6 F4 gerbang tes (harus SCREENING+)', () => {
  let postingId = '';
  let cookie = '';
  let applicationId = '';
  const email = `kandidat.gerbang.${Date.now()}@example.com`;

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    await client.exec(`UPDATE job_postings SET is_public = TRUE, status = 'OPEN' WHERE id IN (SELECT id FROM job_postings LIMIT 3);`);
    const q = await client.query<{ id: string }>(`SELECT id FROM job_postings WHERE is_public = TRUE LIMIT 1`);
    postingId = q.rows[0].id;

    const reg = await register(jsonReq('/x', { fullName: 'Kandidat Gerbang', email, password: 'rahasia123' }));
    expect(reg.status).toBe(200);
    cookie = cookieOf(reg);

    const app = await apply(jsonReq('/x', { fullName: 'Kandidat Gerbang', email, jobPostingId: postingId }, cookie));
    expect(app.status).toBe(200);
    const appId = ((await app.json()).data.applicationNo) as string;
    const row = await client.query<{ id: string }>(`SELECT id FROM job_applications WHERE application_no = $1 LIMIT 1`, [appId]);
    applicationId = row.rows[0].id;
  });

  it('status SUBMITTED → tes ditolak 403', async () => {
    const client = await getDb();
    await client.query(`UPDATE job_applications SET status = 'SUBMITTED'::application_status_enum WHERE id = $1`, [applicationId]);
    const res = await startTest(jsonReq('/x', { type: 'TECHNICAL' }, cookie));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(String(json.detail ?? json.message ?? '')).toMatch(/belum dibuka/i);
  });

  it('status REJECTED → tes ditolak 403', async () => {
    const client = await getDb();
    await client.query(`UPDATE job_applications SET status = 'REJECTED'::application_status_enum WHERE id = $1`, [applicationId]);
    const res = await startTest(jsonReq('/x', { type: 'TECHNICAL' }, cookie));
    expect(res.status).toBe(403);
  });

  it('status SCREENING → tes dibuka (200 + attemptId)', async () => {
    const client = await getDb();
    await client.query(`UPDATE job_applications SET status = 'SCREENING'::application_status_enum WHERE id = $1`, [applicationId]);
    const res = await startTest(jsonReq('/x', { type: 'TECHNICAL' }, cookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.attemptId).toBeTruthy();
  });
});
