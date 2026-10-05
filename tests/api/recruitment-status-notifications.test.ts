import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { PATCH as patchStatus } from '@/app/api/v1/recruitment/candidates/[id]/status/route';
import { POST as postDecision } from '@/app/api/v1/recruitment/candidates/[id]/decision/route';

const HR_USER = 'e0000000-0000-4000-8000-000000000002';

function req(path: string, method: string, body: unknown, cookie?: string): NextRequest {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest(`http://localhost:3000${path}`, { method, headers, body: JSON.stringify(body) });
}

describe('WS-6 F6 notifikasi tiap transisi status HR', () => {
  let postingId = '';
  let cookie = '';
  let applicationId = '';
  const email = `kandidat.status.${Date.now()}@example.com`;

  async function notifCount(): Promise<number> {
    const client = await getDb();
    const r = await client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM candidate_notifications WHERE application_id = $1`, [applicationId],
    );
    return r.rows[0].n;
  }

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    await client.exec(`UPDATE job_postings SET is_public = TRUE, status = 'OPEN' WHERE id IN (SELECT id FROM job_postings LIMIT 3);`);
    const q = await client.query<{ id: string }>(`SELECT id FROM job_postings WHERE is_public = TRUE LIMIT 1`);
    postingId = q.rows[0].id;
    cookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: HR_USER, employeeId: null, role: 'HR_MANAGER', email: 'siti.nurhaliza@eperformiq.co.id' })}`;

    const stamp = Date.now().toString(16).padEnd(12, '0').slice(0, 12);
    const candidateId = `c9000000-0000-4000-8000-${stamp}`;
    applicationId = `a9000000-0000-4000-8000-${stamp}`;
    await client.query(
      `INSERT INTO candidates (id, full_name, email) VALUES ($1, 'Kandidat Status', $2)`,
      [candidateId, email],
    );
    await client.query(
      `INSERT INTO job_applications (id, application_no, candidate_id, job_posting_id, status)
       VALUES ($1, $2, $3, $4, 'SUBMITTED'::application_status_enum)`,
      [applicationId, `APP-STAT-${Date.now()}`, candidateId, postingId],
    );
  });

  it('SCREENING membuat notifikasi', async () => {
    const before = await notifCount();
    const res = await patchStatus(req('/x', 'PATCH', { status: 'SCREENING' }, cookie), { params: { id: applicationId } });
    expect(res.status).toBe(200);
    expect(await notifCount()).toBeGreaterThan(before);
  });

  it('OFFERED membuat notifikasi', async () => {
    const before = await notifCount();
    const res = await patchStatus(req('/x', 'PATCH', { status: 'OFFERED' }, cookie), { params: { id: applicationId } });
    expect(res.status).toBe(200);
    expect(await notifCount()).toBeGreaterThan(before);
  });

  it('HIRED (tahap sama DECISION) tetap membuat notifikasi baru', async () => {
    const before = await notifCount();
    const res = await patchStatus(req('/x', 'PATCH', { status: 'HIRED' }, cookie), { params: { id: applicationId } });
    expect(res.status).toBe(200);
    // Gap lama: OFFERED→HIRED sama-sama DECISION → tidak ada notifikasi. Kini harus ada.
    expect(await notifCount()).toBeGreaterThan(before);
  });

  it('keputusan REJECTED membuat notifikasi', async () => {
    const other = `a9000000-0000-4000-8000-${Date.now().toString(16).padEnd(12, '0').slice(0, 12)}`;
    const client = await getDb();
    const stamp = Date.now().toString(16).padEnd(12, '0').slice(0, 12);
    const cand = `c9000000-0000-4000-8000-${stamp}`;
    await client.query(`INSERT INTO candidates (id, full_name, email) VALUES ($1, 'Kandidat Tolak', $2)`, [cand, `tolak.${stamp}@example.com`]);
    await client.query(
      `INSERT INTO job_applications (id, application_no, candidate_id, job_posting_id, status)
       VALUES ($1, $2, $3, $4, 'INTERVIEW'::application_status_enum)`,
      [other, `APP-REJ-${Date.now()}`, cand, postingId],
    );
    const before = (await client.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM candidate_notifications WHERE application_id = $1`, [other])).rows[0].n;
    const res = await postDecision(req('/x', 'POST', { decision: 'REJECTED' }, cookie), { params: { id: other } });
    expect(res.status).toBe(200);
    const after = (await client.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM candidate_notifications WHERE application_id = $1`, [other])).rows[0].n;
    expect(after).toBeGreaterThan(before);
  });
});
