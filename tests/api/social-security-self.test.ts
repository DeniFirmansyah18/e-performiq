import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import type { SqlClient } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET } from '@/app/api/v1/me/social-security/route';

const req = (token: string) =>
  new NextRequest('http://localhost:3000/api/v1/me/social-security', {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
  });

describe('GET /me/social-security — kartu BPJS diri sendiri', () => {
  let client: SqlClient;

  beforeAll(async () => {
    client = await getDb();
    await runSeed(client);
  });

  /** Buat karyawan unik per uji agar tidak bergantung isi seed. */
  async function karyawanBaru(suffix: string): Promise<string> {
    const stamp = Date.now() + '-' + suffix;
    const r = await client.query<{ id: string }>(
      `INSERT INTO employees (employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
       VALUES ($1, $2, $3,
               (SELECT id FROM departments LIMIT 1),
               (SELECT id FROM job_positions LIMIT 1),
               'PERMANENT', 8000000, '2024-01-01')
       RETURNING id`,
      ['BPJS-' + stamp, 'Uji BPJS ' + stamp, `bpjs.${stamp}@example.com`]
    );
    return r.rows[0].id;
  }

  it('pegawai terdaftar mendapat 200 dengan nomor tersamar', async () => {
    const empId = await karyawanBaru('terdaftar');
    await client.query(
      `INSERT INTO employee_social_security
         (employee_id, bpjs_tk_number, bpjs_kes_number, bpjs_kes_class, bpjs_tk_status, bpjs_kes_status, registered_at)
       VALUES ($1, '2109999999990123', '0009999999990123', 'Kelas 1', 'ACTIVE', 'ACTIVE', '2024-01-01')`,
      [empId]
    );

    const token = await signSession({ userId: 'u-bpjs-emp', employeeId: empId, role: 'EMPLOYEE', email: 'uji.u-bpjs-emp@eperformiq.co.id' } as any);
    const res = await GET(req(token));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.registered).toBe(true);
    expect(json.data.bpjsTkNumber).toMatch(/•+0123$/);
  });

  it('pegawai belum terdaftar mendapat 200 dengan registered=false (bukan 404)', async () => {
    const empId = await karyawanBaru('belum');
    const token = await signSession({ userId: 'u-bpjs-emp', employeeId: empId, role: 'EMPLOYEE', email: 'uji.u-bpjs-emp@eperformiq.co.id' } as any);
    const res = await GET(req(token));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.registered).toBe(false);
    expect(json.data.bpjsTkNumber).toBeNull();
  });

  it('BOD boleh melihat kartu BPJS-nya sendiri', async () => {
    const empId = await karyawanBaru('bod');
    const token = await signSession({ userId: 'u-bpjs-bod', employeeId: empId, role: 'BOD', email: 'uji.u-bpjs-bod@eperformiq.co.id' } as any);
    const res = await GET(req(token));
    expect(res.status).toBe(200);
  });

  it('People Manager boleh melihat kartu BPJS-nya sendiri', async () => {
    const empId = await karyawanBaru('pm');
    const token = await signSession({ userId: 'u-bpjs-pm', employeeId: empId, role: 'PEOPLE_MANAGER', email: 'uji.u-bpjs-pm@eperformiq.co.id' } as any);
    const res = await GET(req(token));
    expect(res.status).toBe(200);
  });
});
