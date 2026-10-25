import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { db } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getWorkload } from '@/app/api/v1/hr/workload-summary/route';
import { GET as getContracts } from '@/app/api/v1/hr/contracts-summary/route';
import { GET as getActions } from '@/app/api/v1/hr/action-recommendations/route';
import { GET as getCareer } from '@/app/api/v1/hr/career-guidance/[id]/route';

const BUDI = 'b0000000-0000-4000-8000-000000000004';

const req = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: 'GET',
    headers: new Headers(cookie ? { cookie } : {}),
  });

describe('HR Command Center API Endpoints (Integration)', () => {
  let client: PGlite;
  let hrCookie = '';
  let empCookie = '';

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    const testDb = drizzle(client) as unknown as Db;
    (db as any).execute = (q: any) => testDb.execute(q);

    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({
      userId: 'e0000000-0000-4000-8000-000000000001',
      employeeId: null,
      role: 'HR_MANAGER',
      email: 'hr@eperformiq.co.id',
    })}`;
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({
      userId: 'e0000000-0000-4000-8000-000000000005',
      employeeId: BUDI,
      role: 'EMPLOYEE',
      email: 'budi.pratama@eperformiq.co.id',
    })}`;
  }, 60000);

  afterAll(async () => {
    await client.close();
  });

  it('GET /api/v1/hr/workload-summary returns 200 and workload data', async () => {
    const res = await getWorkload(req('/api/v1/hr/workload-summary', hrCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('success');
    expect(json.data.averageHours).toBeDefined();
    expect(json.data.capacityHours).toBeGreaterThan(0);
  });

  it('GET /api/v1/hr/contracts-summary returns 200 and contract stats', async () => {
    const res = await getContracts(
      req('/api/v1/hr/contracts-summary?refDate=2026-10-25', hrCookie)
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('success');
    expect(json.data.totalPkwt).toBeDefined();
    expect(json.data.referenceDate).toBe('2026-10-25');
  });

  it('GET /api/v1/hr/action-recommendations returns 200 and recommendations array', async () => {
    const res = await getActions(req('/api/v1/hr/action-recommendations', hrCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('success');
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('GET /api/v1/hr/career-guidance/:id returns career ladder for HR', async () => {
    const res = await getCareer(req(`/api/v1/hr/career-guidance/${BUDI}`, hrCookie), {
      params: { id: BUDI },
    } as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.employeeId).toBe(BUDI);
    expect(json.data.currentGpa).toBe(3.67);
  });

  it('menolak permintaan tanpa sesi (401)', async () => {
    const res = await getWorkload(req('/api/v1/hr/workload-summary'));
    expect(res.status).toBe(401);
  });

  it('menolak peran tanpa izin baca kepegawaian (403)', async () => {
    // ASSESSOR tidak punya 'employment:read'.
    const assessorCookie = `${SESSION_COOKIE_NAME}=${await signSession({
      userId: 'e0000000-0000-4000-8000-000000000007',
      employeeId: 'b0000000-0000-4000-8000-000000000011',
      role: 'ASSESSOR',
      email: 'aris.assessor@eperformiq.co.id',
    })}`;
    const res = await getContracts(req('/api/v1/hr/contracts-summary', assessorCookie));
    expect(res.status).toBe(403);
  });

  it('karyawan tidak dapat melihat panduan karir pegawai lain (403)', async () => {
    const other = 'b0000000-0000-4000-8000-000000000007';
    const res = await getCareer(req(`/api/v1/hr/career-guidance/${other}`, empCookie), {
      params: { id: other },
    } as any);
    expect(res.status).toBe(403);
  });

  it('mengembalikan 404 untuk pegawai yang tidak ada', async () => {
    const res = await getCareer(
      req('/api/v1/hr/career-guidance/00000000-0000-4000-8000-000000000000', hrCookie),
      { params: { id: '00000000-0000-4000-8000-000000000000' } } as any
    );
    expect(res.status).toBe(404);
  });
});
