import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getStatus } from '@/app/api/v1/me/daily-status/route';
import { GET as getRecap } from '@/app/api/v1/me/performance-recap/route';
import { GET as getTeam } from '@/app/api/v1/performance/daily-status/team/route';

const MGR_USER = 'e0000000-0000-4000-8000-000000000002';
const MGR_EMPLOYEE = 'b0000000-0000-4000-8000-000000000002';

const getReq = (path: string, c?: string) => {
  const headers = new Headers();
  if (c) headers.set('cookie', c);
  return new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers });
};

describe('daily status & recap routes', () => {
  let employeeId = '';
  let empCookie = '';
  let mgrCookie = '';

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);

    const stamp = Date.now();
    const emp = await client.query<{ id: string }>(
      `INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date, manager_id)
       VALUES (gen_random_uuid(), $1, 'Status Harian Uji', $2,
               'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
               'PERMANENT', 8000000, CURRENT_DATE, $3::uuid)
       RETURNING id`,
      [`DS-${stamp}`, `ds.${stamp}@eperformiq.co.id`, MGR_EMPLOYEE],
    );
    employeeId = emp.rows[0].id;

    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: `u-${stamp}`, employeeId, role: 'EMPLOYEE', email: `ds.${stamp}@eperformiq.co.id` })}`;
    mgrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: MGR_USER, employeeId: MGR_EMPLOYEE, role: 'PEOPLE_MANAGER', email: 'mgr@eperformiq.co.id' })}`;
  });

  it('GET daily-status tanpa sesi → 401', async () => {
    const res = await getStatus(getReq('/api/v1/me/daily-status'));
    expect(res.status).toBe(401);
  });

  it('GET daily-status mengembalikan snapshot + ambang', async () => {
    const res = await getStatus(getReq('/api/v1/me/daily-status?date=2026-10-02', empCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveProperty('trafficLight');
    expect(json.data.thresholds.green).toBe(90);
    expect(json.data.thresholds.yellow).toBe(70);
  });

  it('GET performance-recap menolak period tak dikenal', async () => {
    const res = await getRecap(getReq('/api/v1/me/performance-recap?period=weekly', empCookie));
    expect(res.status).toBe(400);
  });

  it('GET performance-recap bulanan berhasil', async () => {
    const res = await getRecap(getReq('/api/v1/me/performance-recap?period=monthly&anchor=2026-10-15', empCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.period).toBe('monthly');
  });

  it('GET team status hanya untuk atasan', async () => {
    const denied = await getTeam(getReq('/api/v1/performance/daily-status/team', empCookie));
    expect(denied.status).toBeGreaterThanOrEqual(400);

    const okRes = await getTeam(getReq('/api/v1/performance/daily-status/team?date=2026-10-03', mgrCookie));
    expect(okRes.status).toBe(200);
    const json = await okRes.json();
    expect(Array.isArray(json.data.items)).toBe(true);
  });
});
