import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getIndicators } from '@/app/api/v1/me/kpi-indicators/route';
import { GET as getEntries, POST as postEntry } from '@/app/api/v1/me/kpi-daily-entries/route';
import { PUT as putVerify } from '@/app/api/v1/performance/kpi-daily-entries/[id]/verify/route';

const MGR_USER = 'e0000000-0000-4000-8000-000000000002';

const getReq = (path: string, c: string) =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: new Headers({ cookie: c }) });
const jsonReq = (path: string, method: string, body: unknown, c: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: new Headers({ 'Content-Type': 'application/json', cookie: c }),
    body: JSON.stringify(body),
  });

describe('daily KPI routes', () => {
  let employeeId = '';
  let empCookie = '';
  let mgrCookie = '';
  let indicatorId = '';

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);

    const stamp = Date.now();
    const emp = await client.query<{ id: string }>(
      `INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
       VALUES (gen_random_uuid(), $1, 'KPI Harian Uji', $2,
               'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
               'PERMANENT', 8000000, CURRENT_DATE)
       RETURNING id`,
      [`KPI-${stamp}`, `kpi.${stamp}@eperformiq.co.id`],
    );
    employeeId = emp.rows[0].id;

    const period = await client.query<{ id: string }>(`SELECT id FROM appraisal_periods LIMIT 1`);
    const pillar = await client.query<{ id: string }>(`SELECT id FROM strategic_pillars LIMIT 1`);
    const kpi = await client.query<{ id: string }>(
      `INSERT INTO individual_kpis
         (period_id, employee_id, strategic_pillar_id, kpi_title, target_value, unit_of_measure, kpi_weight)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, 10, 'tiket', 100)
       RETURNING id`,
      [period.rows[0].id, employeeId, pillar.rows[0].id, `Tiket selesai ${stamp}`],
    );

    const ind = await client.query<{ id: string }>(
      `INSERT INTO kpi_indicators (kpi_id, indicator_name, target_value, indicator_weight)
       VALUES ($1::uuid, 'Tiket selesai', 10, 100) RETURNING id`,
      [kpi.rows[0].id],
    );
    indicatorId = ind.rows[0].id;

    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: `u-${stamp}`, employeeId, role: 'EMPLOYEE', email: `kpi.${stamp}@eperformiq.co.id` })}`;
    mgrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: MGR_USER, employeeId: 'b0000000-0000-4000-8000-000000000002', role: 'PEOPLE_MANAGER', email: 'mgr@eperformiq.co.id' })}`;
  });

  it('karyawan melihat indikator harian aktif', async () => {
    const res = await getIndicators(getReq('/api/v1/me/kpi-indicators', empCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.items.some((i: any) => i.id === indicatorId)).toBe(true);
  });

  it('menyimpan draf lalu mengirim entri', async () => {
    const draft = await postEntry(jsonReq('/api/v1/me/kpi-daily-entries', 'POST', {
      indicatorId, entryDate: '2026-10-21', actualValue: 8, note: 'delapan tiket', submit: false,
    }, empCookie));
    expect(draft.status).toBe(200);
    expect((await draft.json()).data.status).toBe('DRAFT');

    const sent = await postEntry(jsonReq('/api/v1/me/kpi-daily-entries', 'POST', {
      indicatorId, entryDate: '2026-10-21', actualValue: 9, submit: true,
    }, empCookie));
    expect(sent.status).toBe(200);
    const json = await sent.json();
    expect(json.data.status).toBe('SUBMITTED');
  });

  it('menolak nilai negatif', async () => {
    const res = await postEntry(jsonReq('/api/v1/me/kpi-daily-entries', 'POST', {
      indicatorId, entryDate: '2026-10-22', actualValue: -1, submit: true,
    }, empCookie));
    expect(res.status).toBe(400);
  });

  it('atasan memverifikasi entri, verifikasi kedua ditolak', async () => {
    const list = await getEntries(getReq('/api/v1/me/kpi-daily-entries?from=2026-10-21&to=2026-10-21', empCookie));
    const entry = (await list.json()).data.items[0];
    expect(entry.status).toBe('SUBMITTED');

    const res = await putVerify(
      jsonReq(`/api/v1/performance/kpi-daily-entries/${entry.id}/verify`, 'PUT', { decision: 'VERIFIED' }, mgrCookie),
      { params: { id: entry.id } } as any,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe('VERIFIED');

    const second = await putVerify(
      jsonReq(`/api/v1/performance/kpi-daily-entries/${entry.id}/verify`, 'PUT', { decision: 'REJECTED', reason: 'salah' }, mgrCookie),
      { params: { id: entry.id } } as any,
    );
    expect(second.status).toBeGreaterThanOrEqual(400);
  });

  it('rekap entri mengembalikan entri yang sudah diverifikasi', async () => {
    const res = await getEntries(getReq('/api/v1/me/kpi-daily-entries?from=2026-10-01&to=2026-10-31', empCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.items[0].status).toBe('VERIFIED');
  });

  it('entri indikator milik karyawan lain ditolak', async () => {
    const res = await postEntry(jsonReq('/api/v1/me/kpi-daily-entries', 'POST', {
      indicatorId, entryDate: '2026-10-23', actualValue: 1, submit: true,
    }, mgrCookie));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
