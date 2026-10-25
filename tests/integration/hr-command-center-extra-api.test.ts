import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { db } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getProfile } from '@/app/api/v1/hr/workforce-profile/route';
import { GET as getDirectory } from '@/app/api/v1/hr/employee-directory/route';
import { GET as getContribution } from '@/app/api/v1/hr/employees/[id]/bsc-contribution/route';

const BUDI = 'b0000000-0000-4000-8000-000000000004';

const req = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: 'GET',
    headers: new Headers(cookie ? { cookie } : {}),
  });

async function cookieFor(role: any, employeeId: string | null = null) {
  return `${SESSION_COOKIE_NAME}=${await signSession({
    userId: 'u-test',
    employeeId,
    role,
    email: `${role.toLowerCase()}@eperformiq.co.id`,
  })}`;
}

describe('Command Center HRD - endpoint tambahan (pilar 3 & 7)', () => {
  let client: PGlite;
  let hrCookie = '';
  let bodCookie = '';
  let empCookie = '';

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    const testDb = drizzle(client) as unknown as Db;
    (db as any).execute = (q: any) => testDb.execute(q);

    hrCookie = await cookieFor('HR_MANAGER');
    bodCookie = await cookieFor('BOD');
    empCookie = await cookieFor('EMPLOYEE', BUDI);
  }, 60000);

  afterAll(async () => {
    await client.close();
  });

  describe('GET /api/v1/hr/workforce-profile', () => {
    it('mengembalikan profil tenaga kerja untuk HR', async () => {
      const res = await getProfile(req('/api/v1/hr/workforce-profile', hrCookie));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('success');
      expect(json.data.headcount.total).toBeGreaterThan(0);
      expect(Array.isArray(json.data.byDepartment)).toBe(true);
    });

    it('menolak tanpa sesi (401)', async () => {
      const res = await getProfile(req('/api/v1/hr/workforce-profile'));
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/hr/employee-directory', () => {
    it('dapat diakses HR', async () => {
      const res = await getDirectory(req('/api/v1/hr/employee-directory', hrCookie));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.employees.length).toBeGreaterThan(0);
    });

    it('dapat diakses BOD (tidak mensyaratkan recruitment:manage)', async () => {
      const res = await getDirectory(req('/api/v1/hr/employee-directory', bodCookie));
      expect(res.status).toBe(200);
    });

    it('menolak peran EMPLOYEE agar direktori tidak jadi sarana enumerasi', async () => {
      const res = await getDirectory(req('/api/v1/hr/employee-directory', empCookie));
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/hr/employees/:id/bsc-contribution', () => {
    it('mengembalikan kontribusi pilar untuk HR', async () => {
      const res = await getContribution(
        req(`/api/v1/hr/employees/${BUDI}/bsc-contribution`, hrCookie),
        { params: { id: BUDI } } as any
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.employeeId).toBe(BUDI);
      expect(json.data.hasKpi).toBe(true);
    });

    it('karyawan boleh melihat kontribusinya sendiri', async () => {
      const res = await getContribution(
        req(`/api/v1/hr/employees/${BUDI}/bsc-contribution`, empCookie),
        { params: { id: BUDI } } as any
      );
      expect(res.status).toBe(200);
    });

    it('karyawan tidak boleh melihat kontribusi pegawai lain (403)', async () => {
      const other = 'b0000000-0000-4000-8000-000000000007';
      const res = await getContribution(
        req(`/api/v1/hr/employees/${other}/bsc-contribution`, empCookie),
        { params: { id: other } } as any
      );
      expect(res.status).toBe(403);
    });

    it('menolak id bukan UUID (400)', async () => {
      const res = await getContribution(
        req('/api/v1/hr/employees/bukan-uuid/bsc-contribution', hrCookie),
        { params: { id: 'bukan-uuid' } } as any
      );
      expect(res.status).toBe(400);
    });

    it('mengembalikan 404 untuk pegawai yang tidak ada', async () => {
      const missing = '00000000-0000-4000-8000-000000000000';
      const res = await getContribution(
        req(`/api/v1/hr/employees/${missing}/bsc-contribution`, hrCookie),
        { params: { id: missing } } as any
      );
      expect(res.status).toBe(404);
    });
  });
});