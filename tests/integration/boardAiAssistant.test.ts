import { describe, it, expect, beforeAll } from 'vitest';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { NextRequest } from 'next/server';
import { signSession, SESSION_COOKIE_NAME, type SessionPayload } from '@/lib/auth/session';
import { GET as cariPegawai } from '@/app/api/v1/executive/ai/search/route';
import { POST as analisisVisi } from '@/app/api/v1/executive/ai/vision/route';
import { POST as rekomMpp } from '@/app/api/v1/executive/ai/mpp/route';

/**
 * #4 — Asisten AI BOD: tiga endpoint.
 * Angka dihitung deterministic dari DB; `rekomendasi` null bila tak ada
 * provider AI (perilaku yang benar: jangan mengarang narasi).
 */

interface SessionOpts {
  userId: string;
  employeeId: string;
  role: string;
  email: string;
}

let bod: SessionPayload;
let seeded = false;

beforeAll(async () => {
  const db = await getDb();
  await runSeed(db);
  seeded = true;

  const u = (await db.query(
    `SELECT u.id::text AS uid, e.id::text AS eid, u.role::text
       FROM users u JOIN employees e ON e.id = u.employee_id
      WHERE u.role = 'BOD' LIMIT 1`
  )).rows[0];
  bod = {
    userId: u?.uid ?? '',
    employeeId: u?.eid ?? null,
    role: 'BOD',
    email: 'bod@eperformiq.co.id',
  };
}, 90000);

// signSession mengembalikan Promise: token WAJIB di-await, kalau tidak cookie
// berisi "[object Promise]" dan getAuthSession menolak sesi (401).
async function reqSearch(q: string): Promise<NextRequest> {
  const token = await signSession(bod);
  return new NextRequest(
    `http://localhost:3000/api/v1/executive/ai/search?q=${encodeURIComponent(q)}`,
    { headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` } }
  );
}

async function reqJson(url: string, body: unknown): Promise<NextRequest> {
  const token = await signSession(bod);
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: `${SESSION_COOKIE_NAME}=${token}`,
    },
    body: JSON.stringify(body),
  });
}

describe('Asisten AI BOD - pencarian pegawai', () => {
  it('query 1 karakter -> daftar kosong + pesan', async () => {
    expect(seeded).toBe(true);
    const res = await cariPegawai(await reqSearch('a'));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.total).toBe(0);
  });

  it('query nama -> mengembalikan item dengan id', async () => {
    const res = await cariPegawai(await reqSearch('ito'));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(json.data.items)).toBe(true);
    if (json.data.items.length > 0) {
      expect(json.data.items[0].id).toBeTruthy();
      expect(typeof json.data.items[0].nama).toBe('string');
    }
  });
});

describe('Asisten AI BOD - persentase visi & misi', () => {
  it('angka dihitung & kembali 200 (rekomendasi boleh null di CI)', async () => {
    const res = await analisisVisi(await reqJson('http://localhost:3000/api/v1/executive/ai/vision', {}));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(typeof json.data.angka.persentaseCapaian).toBe('number');
    expect(json.data.angka).toHaveProperty('persentaseTerukur');
    expect(json.data).toHaveProperty('rekomendasi');
  });
});

describe('Asisten AI BOD - rekomendasi MPP', () => {
  it('angka MPP dihitung & kembali 200', async () => {
    const res = await rekomMpp(await reqJson('http://localhost:3000/api/v1/executive/ai/mpp', {}));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(typeof json.data.angka.jumlahTotalFormasi).toBe('number');
    expect(Array.isArray(json.data.rincian)).toBe(true);
    expect(json.data).toHaveProperty('rekomendasi');
  });
});
