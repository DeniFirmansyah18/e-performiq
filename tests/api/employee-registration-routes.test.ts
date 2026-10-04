import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { POST as register } from '@/app/api/v1/employee/register/route';
import { GET as verify } from '@/app/api/v1/employee/verify/route';

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/v1/employee/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Route memakai singleton .pglite (dev). Siapkan seed via client yang sama
// agar visibel bagi route (pola tests/api/attendance-routes.test.ts).
describe('WS-2 rute registrasi karyawan', () => {
  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
  });

  it('register 200 + PENDING_EMAIL', async () => {
    const email = `route.user.${Date.now()}@example.com`;
    const res = await register(
      post({ fullName: 'Route User', email, password: 'rahasia123' }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe('PENDING_EMAIL');
  });

  it('register email invalid → 4xx', async () => {
    const res = await register(
      post({ fullName: 'X', email: 'bukan-email', password: 'rahasia123' }),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('register → verify roundtrip ok', async () => {
    const email = `route.verify.${Date.now()}@example.com`;
    const reg = await register(
      post({ fullName: 'Verif Route', email, password: 'rahasia123' }),
    );
    expect(reg.status).toBe(200);
    const client = await getDb();
    const q = await client.query<{ verify_token: string }>(
      `SELECT verify_token FROM employee_registrations WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email],
    );
    const token = q.rows[0]?.verify_token;
    expect(token).toBeTruthy();
    const req = new NextRequest(
      `http://localhost:3000/api/v1/employee/verify?token=${token}`,
    );
    const res = await verify(req);
    expect(res.status).toBe(200);
    expect((await res.json()).data.ok).toBe(true);
  });

  it('verify token asing → 4xx', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/v1/employee/verify?token=ngawur',
    );
    const res = await verify(req);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
