import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import type { SqlClient } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as listRisk } from '@/app/api/v1/analytics/flight-risk/route';
import { POST as recompute } from '@/app/api/v1/analytics/flight-risk/recompute/route';

const HR_USER = 'e0000000-0000-4000-8000-000000000002';
const EMP_USER = 'e0000000-0000-4000-8000-000000000004';

const getReq = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: 'GET',
    headers: new Headers(cookie ? { cookie } : {}),
  });

const postReq = (path: string, body: unknown, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: new Headers({
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
    }),
    body: JSON.stringify(body),
  });

describe('flight-risk routes', () => {
  let client: SqlClient;
  let hrCookie = '';
  let empCookie = '';
  let atRiskId = '';
  const AS_OF = '2026-10-20';
  const stamp = Date.now();

  beforeAll(async () => {
    client = await getDb();
    await runSeed(client);

    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({
      userId: HR_USER, employeeId: 'b0000000-0000-4000-8000-000000000002',
      role: 'HR_MANAGER', email: 'hr@eperformiq.co.id',
    })}`;
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({
      userId: EMP_USER, employeeId: 'b0000000-0000-4000-8000-000000000004',
      role: 'EMPLOYEE', email: 'budi@eperformiq.co.id',
    })}`;

    const emp = await client.query<{ id: string }>(
      `INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
       VALUES (gen_random_uuid(), $1, 'Risiko API', $2,
               'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
               'PERMANENT', 8000000, '2026-06-01')
       RETURNING id`,
      [`RISK-API-${stamp}`, `risk.api.${stamp}@eperformiq.co.id`],
    );
    atRiskId = emp.rows[0].id;

    for (let i = 0; i < 12; i++) {
      const d = new Date(`${AS_OF}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - i);
      const day = d.toISOString().slice(0, 10);
      await client.query(
        `INSERT INTO attendance_records (employee_id, work_date, check_in, check_out, is_present, total_work_hours, total_overtime_hours)
         VALUES ($1, $2, '08:00', '17:00', false, 8.00, 0)`,
        [atRiskId, day],
      );
      await client.query(
        `INSERT INTO daily_performance_snapshots (employee_id, snapshot_date, dpi_score, traffic_light, indicators_expected, indicators_filled)
         VALUES ($1, $2, 55, 'RED', 5, 2)`,
        [atRiskId, day],
      );
    }
  });

  it('menolak permintaan tanpa sesi (401)', async () => {
    const res = await listRisk(getReq('/api/v1/analytics/flight-risk'));
    expect(res.status).toBe(401);
  });

  it('menolak EMPLOYEE (403)', async () => {
    const res = await listRisk(getReq('/api/v1/analytics/flight-risk', empCookie));
    expect(res.status).toBe(403);
  });

  it('HR menerima daftar risiko', async () => {
    const res = await listRisk(getReq('/api/v1/analytics/flight-risk', hrCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data.items)).toBe(true);
    expect(json.data).toHaveProperty('total');
  });

  it('recompute menulis snapshot untuk tanggal yang diminta', async () => {
    const res = await recompute(postReq('/api/v1/analytics/flight-risk/recompute', { as_of: AS_OF }, hrCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.processed).toBeGreaterThan(0);

    const rows = await client.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM employee_flight_risk_snapshots WHERE snapshot_date = $1`,
      [AS_OF],
    );
    expect(Number(rows.rows[0].n)).toBeGreaterThan(0);
  });

  it('karyawan berisiko muncul saat difilter band CRITICAL', async () => {
    const res = await listRisk(getReq('/api/v1/analytics/flight-risk?band=CRITICAL&limit=100', hrCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    const ids = json.data.items.map((r: { employeeId: string }) => r.employeeId);
    expect(ids).toContain(atRiskId);
  });

  it('band tidak dikenal ditolak 400', async () => {
    const res = await listRisk(getReq('/api/v1/analytics/flight-risk?band=SANGAT', hrCookie));
    expect(res.status).toBe(400);
  });

  it('EMPLOYEE tidak boleh memicu recompute (403)', async () => {
    const res = await recompute(postReq('/api/v1/analytics/flight-risk/recompute', {}, empCookie));
    expect(res.status).toBe(403);
  });

  it('tanggal tidak valid ditolak 400', async () => {
    const res = await recompute(postReq('/api/v1/analytics/flight-risk/recompute', { as_of: '20-10-2026' }, hrCookie));
    expect(res.status).toBe(400);
  });
});
