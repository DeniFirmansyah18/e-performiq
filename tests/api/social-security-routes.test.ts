import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import type { SqlClient } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { maskNumber } from '@/lib/services/socialSecurityService';
import { GET as getCard } from '@/app/api/v1/me/social-security/route';
import { POST as postReveal } from '@/app/api/v1/me/social-security/reveal/route';

const getReq = (path: string, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: new Headers({ cookie }) });
const postReq = (path: string, body: unknown, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: new Headers({ 'Content-Type': 'application/json', cookie }),
    body: JSON.stringify(body),
  });

describe('social security', () => {
  let client: SqlClient;
  let db: any;
  let empCookie = '';
  let employeeId = '';

  beforeAll(async () => {
    client = await getDb();
    await runSeed(client);

    const stamp = Date.now();
    const emp = await client.query<{ id: string }>(
      `INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
       VALUES (gen_random_uuid(), $1, 'BPJS Uji', $2,
               'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
               'PERMANENT', 8000000, CURRENT_DATE)
       RETURNING id`,
      [`BPJS-${stamp}`, `bpjs.${stamp}@eperformiq.co.id`],
    );
    employeeId = emp.rows[0].id;

    await client.query(
      `INSERT INTO employee_social_security
         (employee_id, bpjs_tk_number, bpjs_kes_number, bpjs_kes_class)
       VALUES ($1::uuid, '8101234567890123', '0001234567890', 'Kelas 1')`,
      [employeeId],
    );

    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: `u-bpjs-${stamp}`, employeeId, role: 'EMPLOYEE', email: `bpjs.${stamp}@eperformiq.co.id` })}`;
    db = client;
  });

  it('maskNumber tidak pernah melempar untuk nilai pendek', () => {
    expect(maskNumber(null)).toBeNull();
    expect(maskNumber('12')).toBe('••');
    expect(maskNumber('8101234567890123')).toBe('••••••••••••0123');
  });

  it('kartu menampilkan nomor ter-masking dan kelas', async () => {
    const res = await getCard(getReq('/api/v1/me/social-security', empCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.bpjsTkNumber).toBe('••••••••••••0123');
    expect(json.data.bpjsKesClass).toBe('Kelas 1');
    expect(JSON.stringify(json.data)).not.toContain('8101234567890123');
  });

  it('reveal tanpa alasan ditolak', async () => {
    const res = await postReveal(postReq('/api/v1/me/social-security/reveal', { reason: 'x' }, empCookie));
    expect(res.status).toBe(400);
  });

  it('reveal mengembalikan nomor penuh dan menulis audit log', async () => {
    const before = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_logs WHERE entity_name = 'employee_social_security'`,
    );

    const res = await postReveal(postReq('/api/v1/me/social-security/reveal', { reason: 'cek kartu fisik' }, empCookie));
    expect(res.status).toBe(200);
    expect((await res.json()).data.bpjsTkNumber).toBe('8101234567890123');

    const after = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_logs WHERE entity_name = 'employee_social_security'`,
    );
    expect(Number(after.rows[0].n)).toBe(Number(before.rows[0].n) + 1);
  });
});
