import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { db } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as listUsers, POST as createUser } from '@/app/api/v1/admin/users/route';
import { PATCH as patchUser } from '@/app/api/v1/admin/users/[id]/route';

const ADMIN_USER = 'e0000000-0000-4000-8000-000000000006'; // Rina — SUPER_ADMIN
const HR_USER = 'e0000000-0000-4000-8000-000000000002'; // Siti — HR_MANAGER

const mkReq = (path: string, cookie: string, body?: unknown) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: body ? 'POST' : 'GET',
    headers: new Headers({
      cookie,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    }),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

const patchReq = (cookie: string, body: unknown) =>
  new NextRequest('http://localhost:3000/api/v1/admin/users/x', {
    method: 'PATCH',
    headers: new Headers({ cookie, 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });

describe('Manajemen Akun SUPER_ADMIN (Integration)', () => {
  let client: PGlite;
  let adminCookie = '';
  let hrCookie = '';

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    const testDb = drizzle(client) as unknown as Db;
    (db as any).execute = (q: any) => testDb.execute(q);

    adminCookie = `${SESSION_COOKIE_NAME}=${await signSession({
      userId: ADMIN_USER,
      employeeId: null,
      role: 'SUPER_ADMIN',
      email: 'admin@eperformiq.co.id',
    })}`;
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({
      userId: HR_USER,
      employeeId: null,
      role: 'HR_MANAGER',
      email: 'siti.nurhaliza@eperformiq.co.id',
    })}`;
  }, 60000);

  afterAll(async () => {
    await client.close();
  });

  it('SUPER_ADMIN dapat membaca seluruh akun tanpa membocorkan kata sandi', async () => {
    const res = await listUsers(mkReq('/api/v1/admin/users', adminCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    const items = json.data.items as Array<Record<string, unknown>>;
    expect(items.length).toBeGreaterThanOrEqual(6);
    expect(items[0]).not.toHaveProperty('password_hash');
    expect(items[0]).not.toHaveProperty('passwordHash');
    expect(json.data.roles).toContain('PEOPLE_MANAGER');
    expect(json.data.roles).not.toContain('ASSESSOR');
  });

  it('HR_MANAGER ditolak (403) saat membaca maupun mengubah akun', async () => {
    const list = await listUsers(mkReq('/api/v1/admin/users', hrCookie));
    expect(list.status).toBe(403);

    const created = await createUser(
      mkReq('/api/v1/admin/users', hrCookie, {
        email: 'baru@eperformiq.co.id',
        role: 'EMPLOYEE',
        password: 'rahasia123',
      })
    );
    expect(created.status).toBe(403);
  });

  it('SUPER_ADMIN dapat membuat akun baru dengan peran tertentu', async () => {
    const res = await createUser(
      mkReq('/api/v1/admin/users', adminCookie, {
        email: 'pm.baru@eperformiq.co.id',
        role: 'PEOPLE_MANAGER',
        password: 'rahasia123',
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.user.role).toBe('PEOPLE_MANAGER');
    expect(json.data.user.isActive).toBe(true);
  });

  it('menolak email duplikat', async () => {
    const res = await createUser(
      mkReq('/api/v1/admin/users', adminCookie, {
        email: 'admin@eperformiq.co.id',
        role: 'EMPLOYEE',
        password: 'rahasia123',
      })
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('menolak penonaktifan SUPER_ADMIN aktif terakhir', async () => {
    // Seed hanya punya satu SUPER_ADMIN aktif (Rina).
    const res = await patchUser(patchReq(adminCookie, { isActive: false }), {
      params: { id: ADMIN_USER },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);

    const still = await client.query<{ is_active: boolean }>(
      'SELECT is_active FROM users WHERE id = $1',
      [ADMIN_USER]
    );
    expect(still.rows[0].is_active).toBe(true);
  });

  it('SUPER_ADMIN dapat mengubah peran akun lain', async () => {
    const target = await client.query<{ id: string }>(
      "SELECT id FROM users WHERE email = 'budi.pratama@eperformiq.co.id'"
    );
    const res = await patchUser(
      patchReq(adminCookie, { role: 'PEOPLE_MANAGER' }),
      { params: { id: target.rows[0].id } }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.user.role).toBe('PEOPLE_MANAGER');
  });
});
