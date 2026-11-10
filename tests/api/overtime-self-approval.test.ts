import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import type { SqlClient } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { PUT } from '@/app/api/v1/me/overtime-requests/[id]/approve/route';

let client: SqlClient;

const SITI_USER = 'e0000000-0000-4000-8000-000000000002';
const SITI_EMP = 'b0000000-0000-4000-8000-000000000002';

async function cookieUntuk(role: string, userId: string, employeeId: string) {
  const token = await signSession({ userId, employeeId, role, email: `uji.${userId}@eperformiq.co.id` } as any);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

function putReq(cookie: string, body: unknown) {
  return new NextRequest('http://localhost:3000/api/v1/me/overtime-requests/x/approve', {
    method: 'PUT',
    headers: new Headers({ 'Content-Type': 'application/json', cookie }),
    body: JSON.stringify(body),
  });
}

async function buatLembur(employeeId: string, userId: string): Promise<string> {
  // Tanggal unik per pemanggilan: constraint unik (employee_id, work_date).
  const unik = new Date(2020, 0, 1 + (Date.now() % 3000)).toISOString().slice(0, 10);
  const r = await client.query<{ id: string }>(
    `INSERT INTO overtime_requests (id, employee_id, work_date, planned_hours, reason, status)
     VALUES (gen_random_uuid(), $1, $2::date, 2.0, 'Uji self-approval lembur', 'SUBMITTED')
     RETURNING id`,
    [employeeId, unik]
  );
  return r.rows[0].id;
}

/**
 * Menyetujui lembur adalah keputusan atasan atas orang lain. Karyawan yang
 * mengajukan lembur tidak boleh menyetujui pengajuannya sendiri, meskipun ia
 * memegang izin `overtime:approve` (mis. HR atau People Manager).
 */
describe('persetujuan lembur menolak self-approval', () => {
  beforeAll(async () => {
    client = await getDb();
    await runSeed(client);
  });

  it('HR ditolak saat menyetujui lembur miliknya sendiri', async () => {
    const id = await buatLembur(SITI_EMP, SITI_USER);
    const cookie = await cookieUntuk('HR_MANAGER', SITI_USER, SITI_EMP);
    const res = await PUT(putReq(cookie, { decision: 'APPROVED' }), { params: { id } });
    expect(res.status).toBe(403);

    const r = await client.query<{ status: string }>('SELECT status FROM overtime_requests WHERE id = $1', [id]);
    expect(r.rows[0].status).not.toBe('APPROVED');
  });

  it('atasan/HR tetap boleh menyetujui lembur pegawai lain', async () => {
    const id = await buatLembur('b0000000-0000-4000-8000-000000000004', SITI_USER);
    const cookie = await cookieUntuk('HR_MANAGER', SITI_USER, SITI_EMP);
    const res = await PUT(putReq(cookie, { decision: 'APPROVED' }), { params: { id } });
    expect(res.status).toBe(200);
  });
});
