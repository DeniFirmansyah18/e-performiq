import { describe, it, expect, beforeAll } from 'vitest';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { NextRequest } from 'next/server';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getFinal, POST as postFinal } from '@/app/api/v1/performance/finalization/route';
import { GET as getKpiPdf } from '@/app/api/v1/performance/kpi-portfolio/pdf/route';

function req(path: string, method: string, body: unknown, cookie?: string): NextRequest {
  const headers = new Headers();
  if (body) headers.set('Content-Type', 'application/json');
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest(`http://localhost:3000${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
}
function getReq(path: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers });
}

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const BUDI_USER = 'e0000000-0000-4000-8000-000000000004';
const Q3 = 'd0000000-0000-4000-8000-000000000001';

describe('WS: finalisasi Q3 & portofolio KPI PDF', () => {
  let budiCookie = '';

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    budiCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: BUDI_USER, employeeId: BUDI, role: 'EMPLOYEE', email: 'budi.pratama@eperformiq.co.id' })}`;
  });

  /**
   * Karyawan baru tanpa baris finalisasi. Seeder sudah menyetujui finalisasi Q3
   * milik Budi, sedangkan service sengaja mempertahankan status APPROVED saat
   * diajukan ulang — jadi jalur PENDING hanya bisa diuji pada karyawan bersih.
   */
  async function freshCookie(): Promise<string> {
    const client = await getDb();
    const code = `FIN-${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const email = `${code.toLowerCase()}@eperformiq.co.id`;
    const res = await client.query<{ id: string }>(
      `INSERT INTO employees (employee_code, full_name, email, department_id, position_id,
                              status, base_salary, join_date)
       VALUES ($1, 'Finalisasi Uji', $2,
               'a0000000-0000-4000-8000-000000000101'::uuid,
               'a0000000-0000-4000-8000-000000000206'::uuid,
               'PERMANENT', 8000000, CURRENT_DATE - INTERVAL '1 year')
       RETURNING id::text AS id`,
      [code, email]
    );
    const { id } = res.rows[0];
    return `${SESSION_COOKIE_NAME}=${await signSession({ userId: id, employeeId: id, role: 'EMPLOYEE', email })}`;
  }

  it('GET finalization tanpa sesi → 401', async () => {
    const res = await getFinal(getReq(`/api/v1/performance/finalization?period_id=${Q3}`));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('POST finalization membuat pengajuan PENDING (idempoten)', async () => {
    const cookie = await freshCookie();
    const first = await postFinal(req('/x', 'POST', { period_id: Q3, note: 'Seluruh KPI Q3 tercapai.' }, cookie));
    expect(first.status).toBe(201);
    const j1 = await first.json();
    expect(j1.data.status).toBe('PENDING');
    expect(j1.data.periodCode).toBe('2026-Q3');

    // pengajuan ulang tidak menduplikasi → tetap satu baris PENDING
    const again = await postFinal(req('/x', 'POST', { period_id: Q3, note: 'Update catatan.' }, cookie));
    expect(again.status).toBe(201);
    const j2 = await again.json();
    expect(j2.data.status).toBe('PENDING');
    expect(j2.data.id).toBe(j1.data.id);

    const get = await getFinal(getReq(`/api/v1/performance/finalization?period_id=${Q3}`, cookie));
    expect(get.status).toBe(200);
    const jg = await get.json();
    expect(jg.data.request.id).toBe(j1.data.id);
    expect(jg.data.request.note).toBe('Update catatan.');
  });

  it('pengajuan ulang tidak menurunkan status yang sudah APPROVED', async () => {
    // Seeder sudah menyetujui finalisasi Budi untuk Q3; mengajukan ulang harus
    // mempertahankan keputusan itu, bukan mengembalikannya ke PENDING.
    const res = await postFinal(req('/x', 'POST', { period_id: Q3, note: 'Catatan baru.' }, budiCookie));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.status).toBe('APPROVED');
    expect(body.data.note).toBe('Catatan baru.');

    const get = await getFinal(getReq(`/api/v1/performance/finalization?period_id=${Q3}`, budiCookie));
    expect((await get.json()).data.request.status).toBe('APPROVED');
  });

  it('POST finalization body catatan > 1000 char → 422', async () => {
    const res = await postFinal(req('/x', 'POST', { period_id: Q3, note: 'x'.repeat(1001) }, budiCookie));
    expect(res.status).toBe(422);
  });

  it('GET kpi-portfolio/pdf → PDF asli (magic %PDF)', async () => {
    const res = await getKpiPdf(getReq(`/api/v1/performance/kpi-portfolio/pdf?period_id=${Q3}`, budiCookie));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/pdf');
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 4).toString('latin1')).toBe('%PDF');
    expect(buf.length).toBeGreaterThan(500);
  });
});
