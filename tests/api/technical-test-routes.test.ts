import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { NextRequest } from 'next/server';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';

vi.mock('@/lib/services/aiService', () => ({
  isAiConfigured: () => true,
  generateContent: vi.fn(async () => ({
    configured: true,
    text: JSON.stringify({
      questions: [
        {
          prompt: 'Apa kompleksitas rata-rata quicksort?',
          options: { A: 'O(n)', B: 'O(n log n)', C: 'O(log n)', D: 'O(n^2)' },
          correctKey: 'B',
          difficulty: 'MEDIUM',
          skillTag: 'Algoritma',
        },
      ],
    }),
  })),
}));

import { POST as generate } from '@/app/api/v1/recruitment/assessments/generate-technical/route';
import { GET as listDrafts } from '@/app/api/v1/recruitment/assessments/questions/drafts/route';
import { POST as approve } from '@/app/api/v1/recruitment/assessments/questions/[id]/approve/route';

function req(path: string, method: string, body: unknown, cookie?: string): NextRequest {
  const headers = new Headers();
  if (body) headers.set('Content-Type', 'application/json');
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}
function getReq(path: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers });
}

describe('WS-4 HR technical-test routes', () => {
  let postingId = '';
  let hrCookie = '';
  let employeeCookie = '';

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    const q = await client.query<{ id: string }>(
      `SELECT id FROM job_postings WHERE required_skills IS NOT NULL AND jsonb_array_length(required_skills) > 0 LIMIT 1`,
    );
    postingId = q.rows[0].id;
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000002', employeeId: 'b0000000-0000-4000-8000-000000000002', role: 'HR_MANAGER', email: 'siti.nurhaliza@eperformiq.co.id' })}`;
    employeeCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000004', employeeId: 'b0000000-0000-4000-8000-000000000004', role: 'EMPLOYEE', email: 'budi.pratama@eperformiq.co.id' })}`;
  });

  // Bersihkan soal AI yang dibuat tes ini dari DB dev (dipakai bersama oleh
  // route test lain) agar tidak mencemari hitungan jumlah soal di suite lain.
  afterAll(async () => {
    const client = await getDb();
    await client.query(`DELETE FROM assessment_questions WHERE source = 'AI'`);
  });

  it('POST generate tanpa sesi → 401', async () => {
    const res = await generate(req('/api/v1/recruitment/assessments/generate-technical', 'POST', { positionId: postingId }));
    expect(res.status).toBe(401);
  });

  it('POST generate sebagai EMPLOYEE → 403', async () => {
    const res = await generate(
      req('/api/v1/recruitment/assessments/generate-technical', 'POST', { positionId: postingId }, employeeCookie),
    );
    expect(res.status).toBe(403);
  });

  it('POST generate sebagai HR → 200 + soal DRAFT tersimpan', async () => {
    const res = await generate(
      req('/api/v1/recruitment/assessments/generate-technical', 'POST', { positionId: postingId, count: 1 }, hrCookie),
    );
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.status).toBe('success');
    expect(json.data.generated).toBeGreaterThanOrEqual(1);
  });

  it('GET drafts sebagai HR → 200 + daftar DRAFT', async () => {
    const res = await listDrafts(getReq(`/api/v1/recruitment/assessments/questions/drafts?positionId=${postingId}`, hrCookie));
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(Array.isArray(json.data.drafts)).toBe(true);
    expect(json.data.drafts.length).toBeGreaterThanOrEqual(1);
  });

  it('POST approve sebagai HR → 200', async () => {
    const draftsRes = await listDrafts(getReq(`/api/v1/recruitment/assessments/questions/drafts?positionId=${postingId}`, hrCookie));
    const draftsJson: any = await draftsRes.json();
    const id = draftsJson.data.drafts[0].id;
    const res = await approve(req(`/api/v1/recruitment/assessments/questions/${id}/approve`, 'POST', {}, hrCookie), {
      params: { id },
    });
    expect(res.status).toBe(200);
  });

  it('POST approve soal tak dikenal → 404', async () => {
    const id = '00000000-0000-4000-8000-000000000000';
    const res = await approve(req(`/api/v1/recruitment/assessments/questions/${id}/approve`, 'POST', {}, hrCookie), {
      params: { id },
    });
    expect(res.status).toBe(404);
  });
});
