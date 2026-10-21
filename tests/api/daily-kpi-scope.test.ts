import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import type { SqlClient } from '@/lib/db/client';
import { GET as getEntries } from '@/app/api/v1/me/kpi-daily-entries/route';

const MGR_USER = 'e0000000-0000-4000-8000-000000000002';
const MGR_EMPLOYEE = 'b0000000-0000-4000-8000-000000000002';

const getReq = (path: string, c: string) =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: new Headers({ cookie: c }) });

describe('daily KPI entry scope (Ruling R6)', () => {
  let client: SqlClient;
  let subordinateId = '';
  let otherId = '';
  let mgrCookie = '';
  let empCookie = '';
  let otherCookie = '';

  beforeAll(async () => {
    client = await getDb();
    await runSeed(client);

    const stamp = Date.now();
    const mk = async (label: string, managerId: string | null) => {
      const res = await client.query<{ id: string }>(
        `INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date, manager_id)
         VALUES (gen_random_uuid(), $1, $2, $3,
                 'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
                 'PERMANENT', 8000000, CURRENT_DATE, $4::uuid)
         RETURNING id`,
        [`${label}-${stamp}`, `${label} Uji`, `${label.toLowerCase()}.${stamp}@eperformiq.co.id`, managerId],
      );
      return res.rows[0].id;
    };

    subordinateId = await mk('Sub', MGR_EMPLOYEE);
    otherId = await mk('Other', null);

    mgrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: MGR_USER, employeeId: MGR_EMPLOYEE, role: 'PEOPLE_MANAGER', email: 'mgr@eperformiq.co.id' })}`;
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: `u-sub-${stamp}`, employeeId: subordinateId, role: 'EMPLOYEE', email: `sub.${stamp}@eperformiq.co.id` })}`;
    otherCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: `u-oth-${stamp}`, employeeId: otherId, role: 'EMPLOYEE', email: `other.${stamp}@eperformiq.co.id` })}`;
  });

  it('atasan boleh membaca entri bawahannya lewat ?employeeId=', async () => {
    const res = await getEntries(getReq(
      `/api/v1/me/kpi-daily-entries?from=2026-10-01&to=2026-10-31&employeeId=${subordinateId}`,
      mgrCookie,
    ));
    expect(res.status).toBe(200);
  });

  it('karyawan tidak boleh membaca entri karyawan lain', async () => {
    const res = await getEntries(getReq(
      `/api/v1/me/kpi-daily-entries?from=2026-10-01&to=2026-10-31&employeeId=${subordinateId}`,
      otherCookie,
    ));
    expect(res.status).toBe(403);
  });

  it('tanpa employeeId karyawan membaca miliknya sendiri', async () => {
    const res = await getEntries(getReq(
      '/api/v1/me/kpi-daily-entries?from=2026-10-01&to=2026-10-31',
      empCookie,
    ));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data.items)).toBe(true);
  });
});
