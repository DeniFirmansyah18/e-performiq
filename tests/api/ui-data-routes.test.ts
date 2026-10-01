import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import type { Db } from '@/lib/db/client';
import { runSeed } from '@/lib/db/seed';
import { signSession } from '@/lib/auth/session';
import { NextRequest } from 'next/server';
import { GET as myScorecardHandler } from '@/app/api/v1/performance/my-scorecard/route';
import { GET as teamRosterHandler } from '@/app/api/v1/performance/team-roster/route';
import { GET as nineBoxSummaryHandler } from '@/app/api/v1/performance/nine-box-summary/route';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const BUDI_USER = 'e0000000-0000-4000-8000-000000000004';
const DANU = 'b0000000-0000-4000-8000-000000000003';
const DANU_USER = 'e0000000-0000-4000-8000-000000000003';

function req(path: string, token?: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

describe('UI data routes (Task 8)', () => {
  let client: PGlite;
  beforeAll(async () => { ({ client } = await createTestDb()); await runSeed(client); });
  afterAll(async () => { await client.close(); });

  it('GET /performance/my-scorecard 401 tanpa sesi', async () => {
    const res = await myScorecardHandler(req('/api/v1/performance/my-scorecard'));
    expect(res.status).toBe(401);
  });

  it('GET /performance/my-scorecard mengembalikan appraisal milik sesi', async () => {
    const token = await signSession({ userId: BUDI_USER, employeeId: BUDI, role: 'EMPLOYEE', email: 'budi.pratama@eperformiq.co.id' });
    const res = await myScorecardHandler(req('/api/v1/performance/my-scorecard', token));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.employeeId).toBe(BUDI);
    expect(Number(json.data.compositeGpa)).toBeGreaterThan(0);
  });

  it('GET /performance/my-scorecard 403 untuk id karyawan lain', async () => {
    const token = await signSession({ userId: BUDI_USER, employeeId: BUDI, role: 'EMPLOYEE', email: 'budi.pratama@eperformiq.co.id' });
    const res = await myScorecardHandler(req(`/api/v1/performance/my-scorecard?employee_id=${DANU}`, token));
    expect(res.status).toBe(403);
  });

  it('GET /performance/team-roster mengembalikan bawahan sesuai scope (manager)', async () => {
    const token = await signSession({ userId: DANU_USER, employeeId: DANU, role: 'PEOPLE_MANAGER', email: 'danu.tech@eperformiq.co.id' });
    const res = await teamRosterHandler(req('/api/v1/performance/team-roster', token));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data.members)).toBe(true);
    expect(json.data.members.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /performance/nine-box-summary menjumlahkan total dengan benar', async () => {
    const token = await signSession({ userId: BUDI_USER, employeeId: BUDI, role: 'EMPLOYEE', email: 'budi.pratama@eperformiq.co.id' });
    const res = await nineBoxSummaryHandler(req('/api/v1/performance/nine-box-summary', token));
    expect(res.status).toBe(200);
    const json = await res.json();
    const sum = Object.values(json.data.byQuadrant).reduce((a: number, b) => a + Number(b), 0);
    expect(sum).toBe(json.data.total);
  });
});
