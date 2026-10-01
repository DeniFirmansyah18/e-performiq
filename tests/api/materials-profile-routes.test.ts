import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { signSession } from '@/lib/auth/session';
import { NextRequest } from 'next/server';
import { GET as modulesGet } from '@/app/api/v1/learning/courses/[id]/modules/route';
import { POST as completePost } from '@/app/api/v1/learning/modules/[id]/complete/route';
import { GET as certsGet } from '@/app/api/v1/learning/certificates/route';
import { GET as profileGet, PATCH as profilePatch } from '@/app/api/v1/profile/me/route';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const BUDI_USER = 'e0000000-0000-4000-8000-000000000004';

function req(path: string, token?: string, body?: unknown): NextRequest {
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (body) headers.set('Content-Type', 'application/json');
  return new NextRequest(`http://localhost:3000${path}`, {
    method: body ? 'PATCH' : 'GET', headers, body: body ? JSON.stringify(body) : undefined,
  });
}

describe('materials/profile authenticated routes', () => {
  let client: PGlite;
  beforeAll(async () => { ({ client } = await createTestDb()); await runSeed(client); });
  afterAll(async () => { await client.close(); });

  const courseId = async (code: string) =>
    Number((await client.query<{ id: number }>(`SELECT id FROM moodle_courses WHERE course_code=$1`, [code])).rows[0].id);
  const moduleId = async (title: string) =>
    (await client.query<{ id: string }>(`SELECT id FROM course_modules WHERE title=$1`, [title])).rows[0].id;

  it('GET /learning/courses/:id/modules 401 tanpa sesi', async () => {
    const res = await modulesGet(req('/x'), { params: { id: '1' } });
    expect(res.status).toBe(401);
  });

  it('GET /learning/courses/:id/modules 200 dengan sesi', async () => {
    const token = await signSession({ userId: BUDI_USER, employeeId: BUDI, role: 'EMPLOYEE', email: 'budi@x.id' });
    const cid = await courseId('ONB-101');
    const res = await modulesGet(req(`/x`, token), { params: { id: String(cid) } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data.modules)).toBe(true);
  });

  it('POST /learning/modules/:id/complete menandai selesai', async () => {
    const token = await signSession({ userId: BUDI_USER, employeeId: BUDI, role: 'EMPLOYEE', email: 'budi@x.id' });
    const mid = await moduleId('Video: Tur Kantor & Budaya Kerja');
    const res = await completePost(req(`/x`, token), { params: { id: mid } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.completed).toBe(true);
  });

  it('GET /learning/certificates 200 dengan array', async () => {
    const token = await signSession({ userId: BUDI_USER, employeeId: BUDI, role: 'EMPLOYEE', email: 'budi@x.id' });
    const res = await certsGet(req('/x', token));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data.certificates)).toBe(true);
  });

  it('PATCH /profile/me memperbarui field dan GET mencerminkannya', async () => {
    const token = await signSession({ userId: BUDI_USER, employeeId: BUDI, role: 'EMPLOYEE', email: 'budi@x.id' });
    const res = await profilePatch(req('/x', token, { phone_number: '+62 811-0000-7777' }));
    expect(res.status).toBe(200);
    const get = await profileGet(req('/x', token));
    const json = await get.json();
    expect(json.data.phoneNumber).toBe('+62 811-0000-7777');
  });
});
