import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb, db as appDb } from '@/lib/db/client';
import { appendActivity } from '@/lib/services/activityFeedService';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getCompany } from '@/app/api/v1/activity-feed/company/route';

const getReq = (path: string, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: new Headers({ cookie }) });

describe('company activity feed', () => {
  let hrCookie = '';
  let empCookie = '';
  let employeeId = '';

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    const db = appDb;

    const stamp = Date.now();
    const emp = await client.query<{ id: string }>(
      `INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
       VALUES (gen_random_uuid(), $1, 'Feed Perusahaan', $2,
               'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
               'PERMANENT', 8000000, CURRENT_DATE) RETURNING id`,
      [`FEEDC-${stamp}`, `feedc.${stamp}@eperformiq.co.id`],
    );
    employeeId = emp.rows[0].id;
    await appendActivity(db, { employeeId, eventType: 'KPI_DAILY', summary: 'Mengirim 2 indikator' });

    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000001', employeeId: 'b0000000-0000-4000-8000-000000000001', role: 'HR_MANAGER', email: 'hr@eperformiq.co.id' })}`;
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000004', employeeId: 'b0000000-0000-4000-8000-000000000004', role: 'EMPLOYEE', email: 'budi@eperformiq.co.id' })}`;
  });

  it('HR melihat feed lintas karyawan beserta nama', async () => {
    const res = await getCompany(getReq('/api/v1/activity-feed/company', hrCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.items.length).toBeGreaterThanOrEqual(1);
    expect(json.data.items.some((e: any) => e.employeeId === employeeId)).toBe(true);
    expect(json.data.items.every((e: any) => typeof e.employeeName === 'string')).toBe(true);
  });

  it('karyawan ditolak', async () => {
    const res = await getCompany(getReq('/api/v1/activity-feed/company', empCookie));
    expect(res.status).toBe(403);
  });

  it('tanpa sesi → 401', async () => {
    const res = await getCompany(getReq('/api/v1/activity-feed/company', ''));
    expect(res.status).toBe(401);
  });

  it('tidak pernah memuat RESTRICTED', async () => {
    const client = await getDb();
    await client.query(
      `INSERT INTO activity_events (employee_id, event_type, summary, visibility)
       VALUES ($1::uuid, 'KPI_DAILY', 'gaji naik', 'RESTRICTED')`,
      [employeeId],
    );

    const res = await getCompany(getReq('/api/v1/activity-feed/company', hrCookie));
    const json = await res.json();
    expect(json.data.items.some((e: any) => e.visibility === 'RESTRICTED')).toBe(false);
  });

  it('limit dibatasi maksimum 500', async () => {
    const res = await getCompany(getReq('/api/v1/activity-feed/company?limit=9999', hrCookie));
    expect(res.status).toBe(200);
  });
});
