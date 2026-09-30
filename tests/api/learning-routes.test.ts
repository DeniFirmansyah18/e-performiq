import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { signSession } from '@/lib/auth/session';
import { NextRequest } from 'next/server';
import { GET as coursesGet } from '@/app/api/v1/learning/courses/route';
import { POST as enrollPost } from '@/app/api/v1/learning/enrollments/route';
import { GET as myLearningGet } from '@/app/api/v1/learning/my-learning/route';
import { GET as profileGet } from '@/app/api/v1/learning/competency-profile/[employeeId]/route';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const BUDI_USER = 'e0000000-0000-4000-8000-000000000004';
const ANISA = 'b0000000-0000-4000-8000-000000000007';

function req(path: string, token?: string, body?: unknown): NextRequest {
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (body) headers.set('Content-Type', 'application/json');
  return new NextRequest(`http://localhost:3000${path}`, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('learning routes', () => {
  let client: PGlite;
  beforeAll(async () => { ({ client } = await createTestDb()); await runSeed(client); });
  afterAll(async () => { await client.close(); });

  it('GET /learning/courses 401 tanpa sesi', async () => {
    const res = await coursesGet(req('/api/v1/learning/courses'));
    expect(res.status).toBe(401);
  });

  it('GET /learning/courses 200 dengan sesi + array courses', async () => {
    const token = await signSession({ userId: BUDI_USER, employeeId: BUDI, role: 'EMPLOYEE', email: 'budi@x.id' });
    const res = await coursesGet(req('/api/v1/learning/courses', token));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data.courses)).toBe(true);
    expect(json.data.courses.length).toBeGreaterThanOrEqual(6);
  });

  it('POST /learning/enrollments 400 untuk body tidak valid', async () => {
    const token = await signSession({ userId: BUDI_USER, employeeId: BUDI, role: 'EMPLOYEE', email: 'budi@x.id' });
    const res = await enrollPost(req('/api/v1/learning/enrollments', token, { courseId: 'x' }));
    expect(res.status).toBe(400);
  });

  it('POST /learning/enrollments 200 untuk courseId valid', async () => {
    const token = await signSession({ userId: BUDI_USER, employeeId: BUDI, role: 'EMPLOYEE', email: 'budi@x.id' });
    const cid = Number((await client.query<{ id: number }>(`SELECT id FROM moodle_courses WHERE course_code='LEAD-ESS'`)).rows[0].id);
    const res = await enrollPost(req('/api/v1/learning/enrollments', token, { courseId: cid }));
    expect(res.status).toBe(200);
  });

  it('GET /learning/my-learning mengembalikan ringkasan', async () => {
    const token = await signSession({ userId: BUDI_USER, employeeId: BUDI, role: 'EMPLOYEE', email: 'budi@x.id' });
    const res = await myLearningGet(req('/api/v1/learning/my-learning', token));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveProperty('courses');
    expect(json.data).toHaveProperty('trainingHours');
    expect(json.data).toHaveProperty('badges');
  });

  it('GET /learning/competency-profile/<other> 403 untuk EMPLOYEE (scope)', async () => {
    const token = await signSession({ userId: BUDI_USER, employeeId: BUDI, role: 'EMPLOYEE', email: 'budi@x.id' });
    const res = await profileGet(req(`/api/v1/learning/competency-profile/${ANISA}`, token), { params: { employeeId: ANISA } });
    expect(res.status).toBe(403);
  });
});
