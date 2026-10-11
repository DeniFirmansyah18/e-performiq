import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as listEmployees } from '@/app/api/v1/hr/employees/route';

function req(path: string, method: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest(`http://localhost:3000${path}`, { method, headers });
}

const HR_USER = 'e0000000-0000-4000-8000-000000000002';

describe('GET /api/v1/hr/employees (directory picker)', () => {
  let hrCookie = '';

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: HR_USER, employeeId: null, role: 'HR_MANAGER', email: 'siti.nurhaliza@eperformiq.co.id' })}`;
  });

  it('mengembalikan daftar karyawan aktif untuk HR', async () => {
    const res = await listEmployees(req('/x', 'GET', hrCookie));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(Array.isArray(j.data.employees)).toBe(true);
    expect(j.data.employees.length).toBeGreaterThan(0);
    const first = j.data.employees[0];
    expect(first).toHaveProperty('employeeId');
    expect(first).toHaveProperty('fullName');
    // Hanya status aktif (PROBATION / PERMANENT / CONTRACT) yang disertakan.
    for (const emp of j.data.employees) {
      expect(['PROBATION', 'PERMANENT', 'CONTRACT']).toContain(emp.status);
    }
  });

  it('menolak permintaan tanpa sesi', async () => {
    const res = await listEmployees(req('/x', 'GET'));
    expect(res.status).toBeGreaterThanOrEqual(401);
  });
});
