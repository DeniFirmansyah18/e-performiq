import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import type { SqlClient } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as integrity } from '@/app/api/v1/audit/integrity/route';
import { insertAuditLog } from '@/lib/repositories/auditRepository';
import { db } from '@/lib/db/client';

const AUDITOR = 'e0000000-0000-4000-8000-000000000005';
const HR = 'e0000000-0000-4000-8000-000000000002';

const getReq = (cookie?: string) =>
  new NextRequest('http://localhost:3000/api/v1/audit/integrity', {
    method: 'GET',
    headers: new Headers(cookie ? { cookie } : {}),
  });

describe('GET /api/v1/audit/integrity', () => {
  let client: SqlClient;
  let auditorCookie = '';
  let hrCookie = '';

  beforeAll(async () => {
    client = await getDb();
    await runSeed(client);

    auditorCookie = `${SESSION_COOKIE_NAME}=${await signSession({
      userId: AUDITOR, employeeId: 'b0000000-0000-4000-8000-000000000005',
      role: 'AUDITOR', email: 'audit@eperformiq.co.id',
    })}`;
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({
      userId: HR, employeeId: 'b0000000-0000-4000-8000-000000000002',
      role: 'HR_MANAGER', email: 'hr@eperformiq.co.id',
    })}`;

    await insertAuditLog(db, {
      actionType: 'CREATE', entityName: 'uji_integritas', recordId: 'i1',
      description: 'entri untuk uji endpoint integritas',
    });
  });

  it('menolak tanpa sesi (401)', async () => {
    const res = await integrity(getReq());
    expect(res.status).toBe(401);
  });

  it('menolak HR_MANAGER (403) — pemisahan tugas GCG', async () => {
    const res = await integrity(getReq(hrCookie));
    expect(res.status).toBe(403);
  });

  it('AUDITOR menerima status integritas rantai', async () => {
    const res = await integrity(getReq(auditorCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveProperty('ok');
    expect(json.data).toHaveProperty('checked');
    expect(json.data).toHaveProperty('legacy');
    expect(json.data).toHaveProperty('firstBrokenId');
    expect(json.data.checked).toBeGreaterThan(0);
  });

  it('tidak membocorkan isi audit log', async () => {
    const res = await integrity(getReq(auditorCookie));
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain('entri untuk uji endpoint integritas');
  });
});
