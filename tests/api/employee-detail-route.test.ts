import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import type { SqlClient } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET } from '@/app/api/v1/hr/employees/[id]/detail/route';

const SITI = 'b0000000-0000-4000-8000-000000000002';
const DANU = 'b0000000-0000-4000-8000-000000000003';
const BUDI = 'b0000000-0000-4000-8000-000000000004';

let client: SqlClient;

async function cookie(role: string, employeeId: string) {
  const token = await signSession({
    userId: `u-${role}-${employeeId.slice(-4)}`,
    employeeId,
    role,
    email: `${role.toLowerCase()}@eperformiq.co.id`,
  } as any);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

const get = (id: string, ck?: string) =>
  new NextRequest(`http://localhost:3000/api/v1/hr/employees/${id}/detail`, {
    method: 'GET',
    headers: ck ? new Headers({ cookie: ck }) : new Headers(),
  });

beforeAll(async () => {
  client = await getDb();
  await runSeed(client);
});

describe('GET /api/v1/hr/employees/:id/detail', () => {
  it('401 tanpa sesi', async () => {
    const res = await GET(get(BUDI), { params: { id: BUDI } });
    expect(res.status).toBe(401);
  });

  it('HR mendapat data lengkap termasuk penggajian', async () => {
    const res = await GET(get(BUDI, await cookie('HR_MANAGER', SITI)), { params: { id: BUDI } });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.data.profil.employeeCode).toBeTruthy();
    expect(j.data.penggajian).toBeTruthy();
    expect(typeof j.data.penggajian.gajiPokok).toBe('number');
    expect(Array.isArray(j.data.penggajian.slip)).toBe(true);
  });

  it('Employee melihat dirinya sendiri, tetapi TIDAK menerima penggajian', async () => {
    const res = await GET(get(BUDI, await cookie('EMPLOYEE', BUDI)), { params: { id: BUDI } });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.data.profil.id).toBe(BUDI);
    // Kunci tidak boleh ada sama sekali, bukan sekadar kosong.
    expect('penggajian' in j.data).toBe(false);
  });

  it('Employee tidak boleh membuka pegawai lain (403)', async () => {
    const res = await GET(get(DANU, await cookie('EMPLOYEE', BUDI)), { params: { id: DANU } });
    expect(res.status).toBe(403);
  });

  it('People Manager boleh membuka bawahan langsung', async () => {
    const res = await GET(get(BUDI, await cookie('PEOPLE_MANAGER', DANU)), { params: { id: BUDI } });
    expect(res.status).toBe(200);
  });

  it('People Manager ditolak untuk pegawai di luar bawahannya', async () => {
    const res = await GET(get(SITI, await cookie('PEOPLE_MANAGER', DANU)), { params: { id: SITI } });
    expect(res.status).toBe(403);
  });

  it('People Manager tidak menerima penggajian bawahannya', async () => {
    const res = await GET(get(BUDI, await cookie('PEOPLE_MANAGER', DANU)), { params: { id: BUDI } });
    const j = await res.json();
    expect('penggajian' in j.data).toBe(false);
  });

  it('id tidak dikenal -> 403/404, bukan 500', async () => {
    const res = await GET(
      get('00000000-0000-4000-8000-000000000000', await cookie('HR_MANAGER', SITI)),
      { params: { id: '00000000-0000-4000-8000-000000000000' } }
    );
    expect([403, 404]).toContain(res.status);
  });
});
