import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { db } from '@/lib/db/client';
import { GET as getWorkload } from '@/app/api/v1/hr/workload-summary/route';
import { GET as getContracts } from '@/app/api/v1/hr/contracts-summary/route';
import { GET as getActions } from '@/app/api/v1/hr/action-recommendations/route';

describe('HR Command Center API Endpoints (Integration)', () => {
  let client: PGlite;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    const testDb = drizzle(client) as unknown as Db;
    (db as any).execute = (q: any) => testDb.execute(q);
  }, 60000);

  afterAll(async () => {
    await client.close();
  });

  it('GET /api/v1/hr/workload-summary returns 200 and workload data', async () => {
    const req = new Request('http://localhost:3000/api/v1/hr/workload-summary');
    const res = await getWorkload(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.averageHours).toBeDefined();
  });

  it('GET /api/v1/hr/contracts-summary returns 200 and contract stats', async () => {
    const req = new Request('http://localhost:3000/api/v1/hr/contracts-summary?refDate=2026-10-25');
    const res = await getContracts(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.totalPkwt).toBeDefined();
  });

  it('GET /api/v1/hr/action-recommendations returns 200 and recommendations array', async () => {
    const res = await getActions();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });
});
