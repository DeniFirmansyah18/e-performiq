import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { POST as apply } from '@/app/api/v1/careers/apply/route';
import { GET as notificationsHealth } from '@/app/api/v1/careers/notifications/health/route';

// Route memakai singleton .pglite (dev). Siapkan seed via client yang sama
// agar visibel bagi route (pola tests/api/employee-registration-routes.test.ts).
function applyReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/v1/careers/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const HR_USER = 'e0000000-0000-4000-8000-000000000002';

describe('WS-6 F3 notifikasi lamaran (email + WA) & health', () => {
  let postingId = '';
  let hrCookie = '';

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    await client.exec(`UPDATE job_postings SET is_public = TRUE, status = 'OPEN' WHERE id IN (SELECT id FROM job_postings LIMIT 3);`);
    const q = await client.query<{ id: string }>(`SELECT id FROM job_postings WHERE is_public = TRUE LIMIT 1`);
    postingId = q.rows[0].id;
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: HR_USER, employeeId: null, role: 'HR_MANAGER', email: 'siti.nurhaliza@eperformiq.co.id' })}`;
  });

  it('apply mengembalikan status notifikasi email & whatsapp', async () => {
    const email = `notif.${Date.now()}@example.com`;
    const res = await apply(applyReq({
      fullName: 'Kandidat Notif', email, phone: '081234567890',
      jobPostingId: postingId, coverLetter: 'Halo',
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.notifications).toBeTruthy();
    expect(typeof json.data.notifications.email).toBe('string');
    expect(typeof json.data.notifications.whatsapp).toBe('string');
  });

  it('mencatat baris di email_outbox & notifikasi in-app', async () => {
    const email = `notif2.${Date.now()}@example.com`;
    const res = await apply(applyReq({
      fullName: 'Kandidat Notif 2', email, phone: '081234567891',
      jobPostingId: postingId, coverLetter: 'Halo',
    }));
    const json = await res.json();
    const applicationNo = json.data.applicationNo as string;
    const client = await getDb();

    const app = await client.query<{ id: string }>(
      `SELECT id FROM job_applications WHERE application_no = $1 LIMIT 1`, [applicationNo],
    );
    const applicationId = app.rows[0].id;

    const outbox = await client.query<{ status: string }>(
      `SELECT status::text AS status FROM email_outbox WHERE related_application_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [applicationId],
    );
    expect(['SENT', 'FAILED', 'QUEUED']).toContain(outbox.rows[0]?.status);

    const inapp = await client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM candidate_notifications WHERE application_id = $1`, [applicationId],
    );
    expect(inapp.rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it('GET /careers/notifications/health mengembalikan provider + recent', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/careers/notifications/health', {
      method: 'GET', headers: { cookie: hrCookie },
    });
    const res = await notificationsHealth(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(typeof json.data.emailProvider).toBe('string');
    expect(typeof json.data.whatsappProvider).toBe('string');
    expect(Array.isArray(json.data.recent)).toBe(true);
  });
});
