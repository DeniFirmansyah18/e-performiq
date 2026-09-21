import { describe, it, expect } from 'vitest';
import { signSession, verifySession, SESSION_COOKIE_NAME } from '@/lib/auth/session';

const PAYLOAD = {
  userId: 'u-1',
  employeeId: 'e-1',
  role: 'EMPLOYEE' as const,
  email: 'uji@x.id',
};

describe('sesi JWT', () => {
  it('menandatangani lalu memverifikasi payload yang sama', async () => {
    const token = await signSession(PAYLOAD);
    expect(await verifySession(token)).toMatchObject(PAYLOAD);
  });

  it('mengembalikan null untuk tanda tangan yang rusak', async () => {
    const token = await signSession(PAYLOAD);
    expect(await verifySession(token.slice(0, -4) + 'XXXX')).toBeNull();
  });

  it('mengembalikan null untuk token kedaluwarsa', async () => {
    expect(await verifySession(await signSession(PAYLOAD, '-1s'))).toBeNull();
  });

  it('mengembalikan null untuk string sembarang, bukan melempar', async () => {
    expect(await verifySession('bukan.token.jwt')).toBeNull();
    expect(await verifySession('')).toBeNull();
  });

  it('memakai nama cookie yang konsisten', () => {
    expect(SESSION_COOKIE_NAME).toBe('eperformiq_token');
  });
});
