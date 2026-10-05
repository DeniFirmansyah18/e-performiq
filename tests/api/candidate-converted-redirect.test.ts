import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { hashPassword } from '@/lib/auth/password';
import { POST as login } from '@/app/api/v1/careers/auth/login/route';
import { GET as me } from '@/app/api/v1/careers/auth/me/route';

function req(path: string, body?: unknown, cookie?: string): NextRequest {
  const headers = new Headers();
  if (body) headers.set('Content-Type', 'application/json');
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest(`http://localhost:3000${path}`, {
    method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined,
  });
}

describe('WS-7 kandidat terkonversi diarahkan ke portal karyawan', () => {
  beforeAll(async () => { await runSeed(await getDb()); });

  it('login akun kandidat nonaktif → 403 + pesan portal karyawan', async () => {
    const email = `converted.${Date.now()}@example.com`;
    const hash = await hashPassword('rahasia123');
    const client = await getDb();
    await client.query(
      `INSERT INTO candidate_accounts (email, password_hash, full_name, is_verified, is_active)
       VALUES ($1, $2, 'Kandidat Jadi Karyawan', TRUE, FALSE)`, [email, hash]);
    const res = await login(req('/x', { email, password: 'rahasia123' }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(String(json.detail ?? json.message ?? '')).toMatch(/portal karyawan/i);
  });

  it('login akun kandidat aktif → 200', async () => {
    const email = `aktif.${Date.now()}@example.com`;
    const hash = await hashPassword('rahasia123');
    const client = await getDb();
    await client.query(
      `INSERT INTO candidate_accounts (email, password_hash, full_name, is_verified, is_active)
       VALUES ($1, $2, 'Kandidat Aktif', TRUE, TRUE)`, [email, hash]);
    const res = await login(req('/x', { email, password: 'rahasia123' }));
    expect(res.status).toBe(200);
  });

  it('GET me menyertakan status converted', async () => {
    const email = `convme.${Date.now()}@example.com`;
    const hash = await hashPassword('rahasia123');
    const client = await getDb();
    const acc = await client.query<{ id: string }>(
      `INSERT INTO candidate_accounts (email, password_hash, full_name, is_verified, is_active)
       VALUES ($1, $2, 'Kandidat Converted Me', TRUE, FALSE) RETURNING id`, [email, hash]);
    const accountId = acc.rows[0].id;
    const { signCandidateSession, CANDIDATE_COOKIE_NAME } = await import('@/lib/auth/candidateSession');
    const token = await signCandidateSession({ accountId, candidateId: null, email, name: 'Kandidat' });
    const res = await me(req('/x', undefined, `${CANDIDATE_COOKIE_NAME}=${token}`));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.account.converted).toBe(true);
  });
});
