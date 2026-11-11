import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { runMigrations } from '@/lib/db/migrate';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import type { SqlClient } from '@/lib/db/client';
import { NextRequest } from 'next/server';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET } from '@/app/api/v1/hr/employee-directory/route';

const SITI = 'b0000000-0000-4000-8000-000000000002';

let client: SqlClient;

beforeAll(async () => {
  client = await getDb();
  await runMigrations(client as any);
  await runSeed(client);
});

afterAll(async () => {
  // Bersihkan bila ada sisa; DB bersama dipakai tes lain.
});

async function cookie(role: string, employeeId: string) {
  const token = await signSession({
    userId: `u-${role}`,
    employeeId,
    role,
    email: 'x@eperformiq.co.id',
  } as any);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

const get = (ck?: string) =>
  new NextRequest('http://localhost:3000/api/v1/hr/employee-directory', {
    method: 'GET',
    headers: ck ? new Headers({ cookie: ck }) : new Headers(),
  });

describe('direktori pegawai menyaring tingkat posisi', () => {
  it('hanya menampilkan pemegang akun berperan EMPLOYEE', async () => {
    const res = await GET(get(await cookie('HR_MANAGER', SITI)));
    expect(res.status).toBe(200);
    const j = await res.json();
    const daftar = j.data?.employees ?? [];
    expect(daftar.length).toBeGreaterThan(0);

    // Bandingkan dengan daftar kode karyawan berperan EMPLOYEE di DB.
    const r = await client.query<{ code: string }>(
      `SELECT e.employee_code AS code
         FROM users u JOIN employees e ON e.id = u.employee_id
        WHERE u.role = 'EMPLOYEE' AND e.status IN ('PROBATION','PERMANENT','CONTRACT')`
    );
    const diharapkan = new Set(r.rows.map((x) => x.code));
    const tampil = new Set(daftar.map((d: any) => d.employeeCode));

    expect(Array.from(tampil).sort()).toEqual(Array.from(diharapkan).sort());
  });

  it('BOD dan People Manager tidak muncul di direktori', async () => {
    const res = await GET(get(await cookie('HR_MANAGER', SITI)));
    const j = await res.json();
    const kode = (j.data?.employees ?? []).map((d: any) => d.employeeCode);

    const r = await client.query<{ code: string }>(
      `SELECT e.employee_code AS code
         FROM users u JOIN employees e ON e.id = u.employee_id
        WHERE u.role IN ('BOD','PEOPLE_MANAGER','SUPER_ADMIN','HR_MANAGER')`
    );
    for (const x of r.rows) {
      expect(kode, `${x.code} seharusnya tidak tampil`).not.toContain(x.code);
    }
  });
});
