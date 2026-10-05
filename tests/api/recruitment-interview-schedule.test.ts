import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { POST as schedule } from '@/app/api/v1/recruitment/interviews/route';
import { PATCH as patchInterview } from '@/app/api/v1/recruitment/interviews/[id]/route';
import { PATCH as patchStatus } from '@/app/api/v1/recruitment/candidates/[id]/status/route';

const HR_USER = 'e0000000-0000-4000-8000-000000000002';

function req(path: string, method: string, body: unknown, cookie: string): NextRequest {
  const headers = new Headers({ 'Content-Type': 'application/json', cookie });
  return new NextRequest(`http://localhost:3000${path}`, { method, headers, body: JSON.stringify(body) });
}

describe('WS-6 F5 jadwal wawancara HR + tautan kandidat', () => {
  let postingId = '';
  let cookie = '';
  let applicationId = '';
  let interviewId = '';
  let candidateId = '';
  let candidateCookie = '';
  const email = `kandidat.wawancara.${Date.now()}@example.com`;

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    await client.exec(`UPDATE job_postings SET is_public = TRUE, status = 'OPEN' WHERE id IN (SELECT id FROM job_postings LIMIT 3);`);
    const q = await client.query<{ id: string }>(`SELECT id FROM job_postings WHERE is_public = TRUE LIMIT 1`);
    postingId = q.rows[0].id;
    cookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: HR_USER, employeeId: null, role: 'HR_MANAGER', email: 'siti.nurhaliza@eperformiq.co.id' })}`;

    // ID unik per run (dev .pglite persisten antar-run).
    const stamp = Date.now().toString(16).padEnd(12, '0').slice(0, 12);
    candidateId = `c9000000-0000-4000-8000-${stamp}`;
    applicationId = `a9000000-0000-4000-8000-${stamp}`;
    const accountId = `cc000000-0000-4000-8000-${stamp}`;

    await client.query(
      `INSERT INTO candidate_accounts (id, email, password_hash, full_name, is_verified)
       VALUES ($1, $2, 'x', 'Kandidat Wawancara', TRUE)`,
      [accountId, email],
    );
    await client.query(
      `INSERT INTO candidates (id, full_name, email, account_id)
       VALUES ($1, 'Kandidat Wawancara', $2, $3)`,
      [candidateId, email, accountId],
    );
    await client.query(
      `INSERT INTO job_applications (id, application_no, candidate_id, job_posting_id, status)
       VALUES ($1, $2, $3, $4, 'SCREENING'::application_status_enum)`,
      [applicationId, `APP-WAWA-${Date.now()}`, candidateId, postingId],
    );

    const { signCandidateSession, CANDIDATE_COOKIE_NAME } = await import('@/lib/auth/candidateSession');
    candidateCookie = `${CANDIDATE_COOKIE_NAME}=${await signCandidateSession({ accountId, candidateId, email, name: 'Kandidat Wawancara' })}`;
  });

  it('POST membuat jadwal SCHEDULED + meetingUrl', async () => {
    const res = await schedule(req('/x', 'POST', {
      applicationId, scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      meetingUrl: 'https://meet.example.com/abc-defg-hij', durationMinutes: 45,
    }, cookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    interviewId = json.data.id;
    expect(json.data.status).toBe('SCHEDULED');

    const client = await getDb();
    const row = await client.query<{ meeting_url: string; status: string }>(
      `SELECT meeting_url, status FROM interview_schedules WHERE id = $1`, [interviewId],
    );
    expect(row.rows[0].meeting_url).toContain('meet.example.com');
    expect(row.rows[0].status).toBe('SCHEDULED');
  });

  it('PATCH status=INTERVIEW memindahkan lamaran ke INTERVIEW', async () => {
    const res = await patchStatus(req('/x', 'PATCH', { status: 'INTERVIEW' }, cookie), { params: { id: applicationId } });
    expect(res.status).toBe(200);
    const client = await getDb();
    const row = await client.query<{ status: string }>(`SELECT status::text AS status FROM job_applications WHERE id = $1`, [applicationId]);
    expect(row.rows[0].status).toBe('INTERVIEW');
  });

  it('PATCH interviews/[id] status=DONE memperbarui jadwal', async () => {
    const res = await patchInterview(req('/x', 'PATCH', { status: 'DONE', score: 85 }, cookie), { params: { id: interviewId } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('DONE');
    const client = await getDb();
    const row = await client.query<{ status: string; score: string }>(`SELECT status, score FROM interview_schedules WHERE id = $1`, [interviewId]);
    expect(row.rows[0].status).toBe('DONE');
    expect(Number(row.rows[0].score)).toBe(85);
  });

  it('timeline kandidat memuat meetingUrl pada tahap INTERVIEW', async () => {
    const client = await getDb();
    const app = await client.query<{ application_no: string }>(`SELECT application_no FROM job_applications WHERE id = $1`, [applicationId]);
    const { getTimelineByApplicationNo } = await import('@/lib/services/timelineService');
    const { db } = await import('@/lib/db/client');
    const tl = await getTimelineByApplicationNo(db, app.rows[0].application_no);
    const iv = tl?.entries.find((e) => e.stage === 'INTERVIEW');
    expect(iv?.meetingUrl).toContain('meet.example.com');
  });

  it('GET /careers/interview kandidat memuat tautan & waktu', async () => {
    const { GET: candidateInterview } = await import('@/app/api/v1/careers/interview/route');
    const res = await candidateInterview(new NextRequest('http://localhost:3000/api/v1/careers/interview', {
      method: 'GET', headers: { cookie: candidateCookie },
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.interview).toBeTruthy();
    expect(json.data.interview.meetingUrl).toContain('meet.example.com');
    expect(json.data.interview.scheduledAt).toBeTruthy();
  });

  it('PATCH tanpa sesi HR → 401', async () => {
    const noCookie = new NextRequest('http://localhost:3000/x', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'DONE' }),
    });
    const res = await patchInterview(noCookie, { params: { id: interviewId } });
    expect(res.status).toBe(401);
  });
});
