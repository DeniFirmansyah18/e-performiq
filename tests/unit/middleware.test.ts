import { describe, it, expect } from 'vitest';
import { middleware } from '@/middleware';
import { NextRequest } from 'next/server';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';

function req(path: string, token?: string): NextRequest {
  const headers = new Headers();
  if (token) headers.set('cookie', `${SESSION_COOKIE_NAME}=${token}`);
  return new NextRequest(`http://localhost:3000${path}`, { headers });
}

describe('middleware role gating (Task 10)', () => {
  it('redirect ke /login bila tidak ada cookie untuk /dashboard', async () => {
    const res = await middleware(req('/dashboard/executive'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('redirect ke /login bila JWT rusak/tidak valid', async () => {
    const res = await middleware(req('/dashboard/executive', 'invalid.token.here'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('EMPLOYEE yang membuka /dashboard/executive diarahkan ke portal karyawan', async () => {
    const token = await signSession({ userId: 'u', employeeId: 'e', role: 'EMPLOYEE', email: 'budi@x.id' });
    const res = await middleware(req('/dashboard/executive', token));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/dashboard/employee-portal');
  });

  it('role yang berhak lolos ke halaman yang diizinkan', async () => {
    const token = await signSession({ userId: 'u', employeeId: 'e', role: 'BOD', email: 'bod@x.id' });
    const res = await middleware(req('/dashboard/executive', token));
    expect(res.status).toBe(200);
  });
});
