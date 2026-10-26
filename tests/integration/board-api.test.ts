import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { db } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getActivity } from '@/app/api/v1/analytics/board-activity/route';
import { GET as getVision } from '@/app/api/v1/analytics/vision-achievement/route';

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

describe('Boardroom API', () => {
  let client: PGlite;
  let bodCookie = '';
  let empCookie = '';

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    const testDb = drizzle(client) as unknown as Db;
    (db as any).execute = (q: any) => testDb.execute(q);

    bodCookie = await cookieFor('BOD');
    empCookie = await cookieFor('EMPLOYEE', BUDI);
  }, 60000);

  afterAll(async () => {
    await client.close();
  });

  describe('GET /api/v1/analytics/board-activity', () => {
    it('menolak tanpa sesi (401)', async () => {
      const res = await getActivity(req('/api/v1/analytics/board-activity'));
      expect(res.status).toBe(401);
    });

    it('menolak peran tanpa analytics:read (403)', async () => {
      const res = await getActivity(req('/api/v1/analytics/board-activity', empCookie));
      expect(res.status).toBe(403);
    });

    it('mengembalikan analitik aktivitas untuk BOD', async () => {
      const res = await getActivity(
        req('/api/v1/analytics/board-activity?fromDate=2026-09-19&toDate=2026-09-24', bodCookie)
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('success');
      expect(json.data.totalEvents).toBeGreaterThan(0);
      expect(json.data.analysis.highlights.length).toBeGreaterThan(0);
    });

    it('tidak mengirim event RESTRICTED ke klien', async () => {
      const res = await getActivity(
        req('/api/v1/analytics/board-activity?fromDate=2026-09-19&toDate=2026-09-24', bodCookie)
      );
      const json = await res.json();
      expect(JSON.stringify(json)).not.toContain('rahasia');
      expect(JSON.stringify(json)).not.toContain('RESTRICTED');
    });

    it('menolak tipe event tak dikenal (400)', async () => {
      const res = await getActivity(
        req('/api/v1/analytics/board-activity?eventType=BUKAN_TIPE', bodCookie)
      );
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/analytics/vision-achievement', () => {
    it('menolak tanpa sesi (401)', async () => {
      const res = await getVision(req('/api/v1/analytics/vision-achievement'));
      expect(res.status).toBe(401);
    });

    it('mengembalikan capaian pilar dan RJMP untuk BOD', async () => {
      const res = await getVision(
        req('/api/v1/analytics/vision-achievement?periodCode=2026-Q3', bodCookie)
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('success');
      expect(json.data.pillars).toHaveLength(4);
      expect(json.data.rjmp).toHaveLength(4);
      expect(json.data.vision).toContain('kelas dunia');
    });

    it('tidak mengembalikan NaN pada payload', async () => {
      const res = await getVision(req('/api/v1/analytics/vision-achievement', bodCookie));
      const raw = await res.text();
      expect(raw).not.toContain('NaN');
      expect(raw).not.toContain('Infinity');
    });
  });
});
