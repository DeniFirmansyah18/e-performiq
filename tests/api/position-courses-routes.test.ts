import { describe, it, expect, beforeAll } from 'vitest';
import { getDb } from '@/lib/db/client';
import { runSeed } from '@/lib/db/seed';
import { NextRequest } from 'next/server';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import {
  GET as getMapping,
  POST as postMapping,
  PATCH as patchMapping,
  DELETE as deleteMapping,
} from '@/app/api/v1/learning/position-courses/route';
import { GET as getOer } from '@/app/api/v1/learning/oer/route';
import { POST as generateCurriculum } from '@/app/api/v1/learning/position-courses/generate/route';

function req(path: string, method: string, body: unknown, cookie?: string): NextRequest {
  const headers = new Headers();
  if (body) headers.set('Content-Type', 'application/json');
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest(`http://localhost:3000${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
}
function getReq(path: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers });
}

const POS_SWE = 'a0000000-0000-4000-8000-000000000204';

describe('Jalur A: endpoint pemetaan kursus-posisi + OER', () => {
  let hrCookie = '';
  let empCookie = '';

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000002', employeeId: null, role: 'HR_MANAGER', email: 'siti.nurhaliza@eperformiq.co.id' })}`;
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000004', employeeId: null, role: 'EMPLOYEE', email: 'budi@eperformiq.co.id' })}`;
  });

  it('GET position-courses tanpa sesi → 401', async () => {
    const res = await getMapping(getReq('/api/v1/learning/position-courses'));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('GET position-courses (HR) mengembalikan posisi + katalog kursus', async () => {
    const res = await getMapping(getReq('/api/v1/learning/position-courses', hrCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data.positions)).toBe(true);
    expect(Array.isArray(json.data.courses)).toBe(true);
    const swe = json.data.positions.find((p: any) => p.positionId === POS_SWE);
    expect(swe).toBeTruthy();
  });

  it('POST mapping menambah kursus ke posisi (HR)', async () => {
    const list = await getMapping(getReq('/api/v1/learning/position-courses', hrCookie));
    const json = await list.json();
    const swe = json.data.positions.find((p: any) => p.positionId === POS_SWE);
    const mappedIds = new Set(swe.courses.map((c: any) => c.courseId));
    const candidate = json.data.courses.find((c: any) => !mappedIds.has(c.courseId));
    expect(candidate).toBeTruthy();

    const res = await postMapping(req('/api/v1/learning/position-courses', 'POST', { positionId: POS_SWE, courseId: candidate.courseId, isMandatory: false }, hrCookie));
    expect(res.status).toBe(201);

    const after = await getMapping(getReq('/api/v1/learning/position-courses', hrCookie));
    const afterJson = await after.json();
    const sweAfter = afterJson.data.positions.find((p: any) => p.positionId === POS_SWE);
    expect(sweAfter.courses.some((c: any) => c.courseId === candidate.courseId)).toBe(true);

    // PATCH ubah wajib & WAJIB update
    const patch = await patchMapping(req('/api/v1/learning/position-courses', 'PATCH', { positionId: POS_SWE, courseId: candidate.courseId, isMandatory: true }, hrCookie));
    expect(patch.status).toBe(200);

    // DELETE bersihkan
    const del = await deleteMapping(req(`/api/v1/learning/position-courses?positionId=${POS_SWE}&courseId=${candidate.courseId}`, 'DELETE', null, hrCookie));
    expect(del.status).toBe(200);
  });

  it('POST mapping oleh EMPLOYEE → 403 (butuh learning:write)', async () => {
    const res = await postMapping(req('/api/v1/learning/position-courses', 'POST', { positionId: POS_SWE, courseId: 1 }, empCookie));
    expect(res.status).toBe(403);
  });

  it('POST generate kurikulum (HR) → kursus tertaut + modul OER', async () => {
    const res = await generateCurriculum(req('/api/v1/learning/position-courses/generate', 'POST', { positionId: POS_SWE, useAi: false }, hrCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.courseCode).toBe('ONB-A0000000');
    expect(json.data.modules.length).toBeGreaterThanOrEqual(3);
    expect(typeof json.data.oerCount).toBe('number');
  });

  it('GET oer search mengembalikan hasil relevan + whitelist domain', async () => {
    const res = await getOer(getReq('/api/v1/learning/oer?q=typescript', hrCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.results.length).toBeGreaterThan(0);
    expect(Array.isArray(json.data.trustedDomains)).toBe(true);
    expect(json.data.results[0].url.startsWith('https://')).toBe(true);
  });
});
