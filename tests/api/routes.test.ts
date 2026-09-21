import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { POST as loginHandler } from '@/app/api/v1/auth/login/route';
import { GET as kpiGetHandler, POST as kpiPostHandler } from '@/app/api/v1/performance/individual-kpis/route';
import { PUT as calibrateHandler } from '@/app/api/v1/performance/appraisals/[id]/calibrate/route';
import { GET as auditGetHandler } from '@/app/api/v1/governance/audit-logs/route';
import { NextRequest } from 'next/server';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const BUDI_USER = 'e0000000-0000-4000-8000-000000000004';
const SITI_USER = 'e0000000-0000-4000-8000-000000000002';
const BAMBANG_USER = 'e0000000-0000-4000-8000-000000000005';
const PERIOD_ID = 'd0000000-0000-4000-8000-000000000001';

describe('API Route Handlers (Integration)', () => {
  let client: PGlite;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
  });

  afterAll(async () => {
    await client.close();
  });

  it('POST /api/v1/auth/login sukses dengan password benar', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'budi.pratama@eperformiq.co.id',
        password: 'enterprise2026',
      }),
    });

    const res = await loginHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('success');
    expect(json.data.user.email).toBe('budi.pratama@eperformiq.co.id');
    expect(json.data.access_token).toBeDefined();
  });

  it('POST /api/v1/auth/login gagal 401 jika password salah', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'budi.pratama@eperformiq.co.id',
        password: 'salah-password',
      }),
    });

    const res = await loginHandler(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.title).toBe('Unauthorized');
  });

  it('GET /api/v1/performance/individual-kpis menolak akses tanpa token (401)', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/performance/individual-kpis');
    const res = await kpiGetHandler(req);
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/performance/individual-kpis sukses dengan token valid', async () => {
    const token = await signSession({
      userId: BUDI_USER,
      employeeId: BUDI,
      role: 'EMPLOYEE',
      email: 'budi.pratama@eperformiq.co.id',
    });

    const req = new NextRequest('http://localhost:3000/api/v1/performance/individual-kpis', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const res = await kpiGetHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('success');
    expect(json.data.items.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/v1/performance/individual-kpis menolak KPI tanpa strategic_pillar_id (422)', async () => {
    const token = await signSession({
      userId: BUDI_USER,
      employeeId: BUDI,
      role: 'EMPLOYEE',
      email: 'budi.pratama@eperformiq.co.id',
    });

    const req = new NextRequest('http://localhost:3000/api/v1/performance/individual-kpis', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        period_id: PERIOD_ID,
        employee_id: BUDI,
        kpi_title: 'KPI Tanpa Pilar',
        target_value: 100,
        kpi_weight: 10,
      }),
    });

    const res = await kpiPostHandler(req);
    expect(res.status).toBe(422);
  });

  it('PUT /api/v1/performance/appraisals/:id/calibrate menolak kalibrasi ulang (409)', async () => {
    const token = await signSession({
      userId: SITI_USER,
      employeeId: 'b0000000-0000-4000-8000-000000000002',
      role: 'HR_MANAGER',
      email: 'siti.nurhaliza@eperformiq.co.id',
    });

    const req = new NextRequest('http://localhost:3000/api/v1/performance/appraisals/40000000-0000-4000-8000-000000000001/calibrate', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        calibration_notes: 'Coba kalibrasi lagi',
      }),
    });

    const res = await calibrateHandler(req, {
      params: { id: '40000000-0000-4000-8000-000000000001' },
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.title).toBe('Immutable Appraisal Record');
  });

  it('GET /api/v1/governance/audit-logs berhasil untuk AUDITOR', async () => {
    const token = await signSession({
      userId: BAMBANG_USER,
      employeeId: 'b0000000-0000-4000-8000-000000000005',
      role: 'AUDITOR',
      email: 'bambang.audit@eperformiq.co.id',
    });

    const req = new NextRequest('http://localhost:3000/api/v1/governance/audit-logs', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const res = await auditGetHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('success');
    expect(json.data.audit_trail.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/governance/audit-logs menolak EMPLOYEE (403)', async () => {
    const token = await signSession({
      userId: BUDI_USER,
      employeeId: BUDI,
      role: 'EMPLOYEE',
      email: 'budi.pratama@eperformiq.co.id',
    });

    const req = new NextRequest('http://localhost:3000/api/v1/governance/audit-logs', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const res = await auditGetHandler(req);
    expect(res.status).toBe(403);
  });
});
