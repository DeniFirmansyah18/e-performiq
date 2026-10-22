import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as health } from '@/app/api/v1/health/route';

const getReq = (cookie?: string) => {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest('http://localhost:3000/api/v1/health', { method: 'GET', headers });
};

describe('GET /api/v1/health', () => {
  let hrCookie = '';

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000001', employeeId: 'b0000000-0000-4000-8000-000000000001', role: 'HR_MANAGER', email: 'hr@eperformiq.co.id' })}`;
  });

  it('tanpa sesi → 401 (tidak membocorkan konfigurasi)', async () => {
    const res = await health(getReq());
    expect(res.status).toBe(401);
  });

  it('karyawan → 403', async () => {
    const empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000004', employeeId: 'b0000000-0000-4000-8000-000000000004', role: 'EMPLOYEE', email: 'budi@eperformiq.co.id' })}`;
    const res = await health(getReq(empCookie));
    expect(res.status).toBe(403);
  });

  it('HR melihat status dependensi', async () => {
    const res = await health(getReq(hrCookie));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveProperty('database');
    expect(json.data).toHaveProperty('storage');
    expect(json.data).toHaveProperty('scanner');
    expect(json.data.database.status).toBe('UP');
    // Storage/scanner boleh DEGRADED bila tidak dikonfigurasi.
    expect(['UP', 'DEGRADED', 'DOWN']).toContain(json.data.storage.status);
    expect(['UP', 'DEGRADED', 'DOWN']).toContain(json.data.scanner.status);
  });

  it('tidak membocorkan kredensial', async () => {
    const res = await health(getReq(hrCookie));
    const text = JSON.stringify(await res.json());
    expect(text).not.toMatch(/secret|password|epqsecretkey/i);
  });
});
