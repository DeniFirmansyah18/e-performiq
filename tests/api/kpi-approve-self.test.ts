import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import type { SqlClient } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { PATCH, POST } from '@/app/api/v1/performance/individual-kpis/route';

const PERIODE = 'd0000000-0000-4000-8000-000000000001';
const PILLAR = 'c0000000-0000-4000-8000-000000000001';

let client: SqlClient;

/** Sesi nyata (JWT) untuk karyawan yang benar-benar ada. */
async function cookieUntuk(role: string, userId: string, employeeId: string) {
  const token = await signSession({ userId, employeeId, role, email: `uji.${userId}@eperformiq.co.id` } as any);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

function patchReq(cookie: string, body: unknown) {
  return new NextRequest('http://localhost:3000/api/v1/performance/individual-kpis', {
    method: 'PATCH',
    headers: new Headers({ 'Content-Type': 'application/json', cookie }),
    body: JSON.stringify(body),
  });
}

async function buatKpi(employeeId: string, judul: string): Promise<string> {
  const r = await client.query<{ id: string }>(
    `INSERT INTO individual_kpis
       (id, period_id, employee_id, strategic_pillar_id, kpi_title, target_value, actual_value,
        unit_of_measure, kpi_weight, status)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, 100, 50, '%', 10, 'SUBMITTED')
     RETURNING id`,
    [PERIODE, employeeId, PILLAR, judul]
  );
  return r.rows[0].id;
}

describe('API persetujuan KPI menolak self-approval untuk semua peran', () => {
  beforeAll(async () => {
    client = await getDb();
    await runSeed(client);
  });

  it('HR ditolak saat menyetujui KPI-nya sendiri (HTTP 403)', async () => {
    const empId = 'b0000000-0000-4000-8000-000000000002';
    const kpiId = await buatKpi(empId, 'KPI API milik HR ' + Date.now());
    const cookie = await cookieUntuk('HR_MANAGER', 'e0000000-0000-4000-8000-000000000002', empId);
    const res = await PATCH(patchReq(cookie, { kpi_id: kpiId, action: 'APPROVE' }));
    expect(res.status).toBe(403);

    const r = await client.query<{ status: string }>('SELECT status FROM individual_kpis WHERE id = $1', [kpiId]);
    expect(r.rows[0].status).not.toBe('APPROVED');
  });

  it('People Manager ditolak saat menyetujui KPI-nya sendiri (HTTP 403)', async () => {
    const empId = 'b0000000-0000-4000-8000-000000000003';
    const kpiId = await buatKpi(empId, 'KPI API milik PM ' + Date.now());
    const cookie = await cookieUntuk('PEOPLE_MANAGER', 'e0000000-0000-4000-8000-000000000003', empId);
    const res = await PATCH(patchReq(cookie, { kpi_id: kpiId, action: 'APPROVE' }));
    expect(res.status).toBe(403);
  });

  it('atasan (BOD) boleh menyetujui KPI bawahannya (HTTP 200)', async () => {
    const empId = 'b0000000-0000-4000-8000-000000000002';
    const kpiId = await buatKpi(empId, 'KPI API untuk disetujui CEO ' + Date.now());
    const cookie = await cookieUntuk('BOD', 'e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001');
    const res = await PATCH(patchReq(cookie, { kpi_id: kpiId, action: 'APPROVE' }));
    expect(res.status).toBe(200);

    const r = await client.query<{ status: string }>('SELECT status FROM individual_kpis WHERE id = $1', [kpiId]);
    expect(r.rows[0].status).toBe('APPROVED');
  });

  it('HR boleh menyetujui KPI pegawai lain (HTTP 200)', async () => {
    const empId = 'b0000000-0000-4000-8000-000000000004';
    const kpiId = await buatKpi(empId, 'KPI API Budi ' + Date.now());
    const cookie = await cookieUntuk('HR_MANAGER', 'e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002');
    const res = await PATCH(patchReq(cookie, { kpi_id: kpiId, action: 'APPROVE' }));
    expect(res.status).toBe(200);
  });
});
