import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb, db as appDb } from '@/lib/db/client';
import { appendActivity } from '@/lib/services/activityFeedService';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getMine } from '@/app/api/v1/activity-feed/route';
import { GET as getTeam } from '@/app/api/v1/activity-feed/team/route';
import { GET as getEmployee } from '@/app/api/v1/activity-feed/[employeeId]/route';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const MGR_USER = 'e0000000-0000-4000-8000-000000000002';
const MGR_EMPLOYEE = 'b0000000-0000-4000-8000-000000000002';

const getReq = (path: string, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: new Headers({ cookie }) });

describe('activity feed routes', () => {
  let empCookie = '';
  let hrCookie = '';
  let mgrCookie = '';
  let subordinateId = '';

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    const db = appDb;

    const stamp = Date.now();
    const emp = await client.query<{ id: string }>(
      `INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date, manager_id)
       VALUES (gen_random_uuid(), $1, 'Feed Uji', $2,
               'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
               'PERMANENT', 8000000, CURRENT_DATE, $3::uuid)
       RETURNING id`,
      [`FEED-${stamp}`, `feed.${stamp}@eperformiq.co.id`, MGR_EMPLOYEE],
    );
    subordinateId = emp.rows[0].id;

    await appendActivity(db, { employeeId: subordinateId, eventType: 'KPI_DAILY', summary: 'Mengirim 2 indikator' });
    await appendActivity(db, {
      employeeId: subordinateId, eventType: 'DISCIPLINARY', summary: 'SP1 diterbitkan', visibility: 'CONFIDENTIAL',
    });

    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000004', employeeId: BUDI, role: 'EMPLOYEE', email: 'budi@eperformiq.co.id' })}`;
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000001', employeeId: 'b0000000-0000-4000-8000-000000000001', role: 'HR_MANAGER', email: 'hr@eperformiq.co.id' })}`;
    mgrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: MGR_USER, employeeId: MGR_EMPLOYEE, role: 'PEOPLE_MANAGER', email: 'mgr@eperformiq.co.id' })}`;
  });

  it('feed sendiri memuat kejadian INTERNAL dan CONFIDENTIAL milik sendiri', async () => {
    const client = await getDb();
    const db = appDb;
    const stamp = Date.now();
    const emp = await client.query<{ id: string }>(
      `INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
       VALUES (gen_random_uuid(), $1, 'Feed Sendiri', $2,
               'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
               'PERMANENT', 8000000, CURRENT_DATE) RETURNING id`,
      [`FEEDS-${stamp}`, `feeds.${stamp}@eperformiq.co.id`],
    );
    const selfId = emp.rows[0].id;
    await appendActivity(db, { employeeId: selfId, eventType: 'KPI_DAILY', summary: 'Mengirim 3 indikator' });
    await appendActivity(db, {
      employeeId: selfId, eventType: 'DISCIPLINARY', summary: 'SP1', visibility: 'CONFIDENTIAL',
    });

    const cookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000009', employeeId: selfId, role: 'EMPLOYEE', email: `feeds.${stamp}@eperformiq.co.id` })}`;
    const res = await getMine(getReq('/api/v1/activity-feed', cookie));
    expect(res.status).toBe(200);
    expect((await res.json()).data.items.length).toBeGreaterThanOrEqual(2);
  });

  it('tidak pernah memuat kejadian RESTRICTED', async () => {
    const client = await getDb();
    await client.query(
      `INSERT INTO activity_events (employee_id, event_type, summary, visibility)
       VALUES ($1::uuid, 'KPI_DAILY', 'gaji naik', 'RESTRICTED')`,
      [BUDI],
    );

    const res = await getMine(getReq('/api/v1/activity-feed', empCookie));
    const json = await res.json();
    expect(json.data.items.some((e: any) => e.visibility === 'RESTRICTED')).toBe(false);
  });

  it('atasan melihat feed bawahannya (termasuk tidak langsung)', async () => {
    const res = await getTeam(getReq('/api/v1/activity-feed/team', mgrCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.items.some((e: any) => e.employeeId === subordinateId)).toBe(true);
    expect(json.data.items.some((e: any) => e.visibility === 'RESTRICTED')).toBe(false);
  });

  it('karyawan tidak boleh membaca feed tim', async () => {
    const res = await getTeam(getReq('/api/v1/activity-feed/team', empCookie));
    expect(res.status).toBe(403);
  });

  it('HR dapat membaca feed karyawan tertentu', async () => {
    const res = await getEmployee(
      getReq(`/api/v1/activity-feed/${subordinateId}`, hrCookie),
      { params: { employeeId: subordinateId } } as any,
    );
    expect(res.status).toBe(200);
  });

  it('karyawan tidak boleh membaca feed karyawan lain', async () => {
    const res = await getEmployee(
      getReq(`/api/v1/activity-feed/${MGR_EMPLOYEE}`, empCookie),
      { params: { employeeId: MGR_EMPLOYEE } } as any,
    );
    expect(res.status).toBe(403);
  });

  it('karyawan boleh membaca feed-nya sendiri lewat :employeeId', async () => {
    const res = await getEmployee(
      getReq(`/api/v1/activity-feed/${BUDI}`, empCookie),
      { params: { employeeId: BUDI } } as any,
    );
    expect(res.status).toBe(200);
  });
});
