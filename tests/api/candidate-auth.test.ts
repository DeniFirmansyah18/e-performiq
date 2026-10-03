import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { NextRequest } from 'next/server';
import { POST as register } from '@/app/api/v1/careers/auth/register/route';
import { POST as login } from '@/app/api/v1/careers/auth/login/route';
import { GET as me, POST as logout } from '@/app/api/v1/careers/auth/me/route';
import { verifyCandidateSession } from '@/lib/auth/candidateSession';
import { verifySession } from '@/lib/auth/session';

function req(path: string, body?: unknown, cookie?: string): NextRequest {
  const headers = new Headers();
  if (body) headers.set('Content-Type', 'application/json');
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest(`http://localhost:3000${path}`, {
    method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined,
  });
}

describe('WS-2 auth kandidat terpisah', () => {
  let client: PGlite;
  beforeAll(async () => { ({ client } = await createTestDb()); });
  afterAll(async () => { await client.close(); });

  it('register membuat akun + cookie kandidat (bukan cookie karyawan)', async () => {
    const res = await register(req('/x', { fullName: 'Kandidat Satu', email: 'Kandidat.Satu@Example.com', password: 'rahasia123' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.account.email).toBe('kandidat.satu@example.com'); // dinormalisasi
    const setCookie = res.headers.get('set-cookie') || '';
    expect(setCookie).toContain('eperformiq_candidate_token');
    expect(setCookie).not.toContain('eperformiq_token=');
  });

  it('register email duplikat ditolak', async () => {
    const res = await register(req('/x', { fullName: 'Dup', email: 'kandidat.satu@example.com', password: 'rahasia123' }));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('login sukses mengembalikan token kandidat; password salah 401', async () => {
    const okRes = await login(req('/x', { email: 'kandidat.satu@example.com', password: 'rahasia123' }));
    expect(okRes.status).toBe(200);
    const token = (await okRes.json()).data.access_token;
    const payload = await verifyCandidateSession(token);
    expect(payload?.email).toBe('kandidat.satu@example.com');
    // token kandidat TIDAK valid sebagai sesi karyawan
    expect(await verifySession(token)).toBeNull();

    const bad = await login(req('/x', { email: 'kandidat.satu@example.com', password: 'salah' }));
    expect(bad.status).toBe(401);
  });

  it('GET me tanpa sesi -> 200 { account: null } (whoami); dengan cookie kandidat -> 200', async () => {
    // Pola whoami: anonim tidak memicu 401 (menghindari noise konsol di halaman publik).
    const anon = await me(req('/x'));
    expect(anon.status).toBe(200);
    expect((await anon.json()).data.account).toBeNull();

    const loginRes = await login(req('/x', { email: 'kandidat.satu@example.com', password: 'rahasia123' }));
    const token = (await loginRes.json()).data.access_token;
    const res = await me(req('/x', undefined, `eperformiq_candidate_token=${token}`));
    expect(res.status).toBe(200);
    expect((await res.json()).data.account.email).toBe('kandidat.satu@example.com');
  });

  it('logout mengosongkan cookie kandidat', async () => {
    const res = await logout(req('/x', {}));
    const setCookie = res.headers.get('set-cookie') || '';
    expect(setCookie).toContain('eperformiq_candidate_token=');
  });
});
