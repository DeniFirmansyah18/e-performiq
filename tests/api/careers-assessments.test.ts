import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { NextRequest } from 'next/server';
import { POST as register } from '@/app/api/v1/careers/auth/register/route';
import { POST as apply } from '@/app/api/v1/careers/apply/route';
import { GET as listAssessments } from '@/app/api/v1/careers/assessments/route';
import { POST as startTest } from '@/app/api/v1/careers/assessments/start/route';
import { POST as submitTest } from '@/app/api/v1/careers/assessments/submit/route';

function jsonReq(path: string, body: unknown, cookie?: string): NextRequest {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest(`http://localhost:3000${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
}
function getReq(path: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers });
}
function cookieOf(res: Response): string {
  const sc = res.headers.get('set-cookie') || '';
  return sc.split(';')[0];
}

describe('WS-6 endpoint asesmen kandidat', () => {
  let client: PGlite;
  let postingId: string;
  let cookie = '';
  // Email unik per run agar tidak bentrok dengan data persist di .pglite dev.
  const email = `kandidat.asesmen.${Date.now()}@example.com`;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    await client.exec(`UPDATE job_postings SET is_public = TRUE, status = 'OPEN' WHERE id IN (SELECT id FROM job_postings LIMIT 3);`);
    const q = await client.query<{ id: string }>(`SELECT id FROM job_postings WHERE is_public = TRUE LIMIT 1`);
    postingId = q.rows[0].id;
  });
  afterAll(async () => { await client.close(); });

  it('tanpa sesi kandidat → 401', async () => {
    const res = await listAssessments(getReq('/x'));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('alur lengkap: register → apply → start → submit teknis', async () => {
    // 1) Register kandidat (set cookie kandidat).
    const reg = await register(jsonReq('/x', { fullName: 'Kandidat Asesmen', email, password: 'rahasia123' }));
    expect(reg.status).toBe(200);
    cookie = cookieOf(reg);

    // 2) Lamar posisi publik dengan cookie kandidat → tertaut ke akun.
    const app = await apply(jsonReq('/x', { fullName: 'Kandidat Asesmen', email, jobPostingId: postingId }, cookie));
    expect(app.status).toBe(200);

    // 3) Daftar asesmen tersedia.
    const list = await listAssessments(getReq('/x', cookie));
    expect(list.status).toBe(200);
    const listJson = await list.json();
    expect(listJson.data.templates.length).toBeGreaterThanOrEqual(3);

    // 4) Mulai tes teknis.
    const start = await startTest(jsonReq('/x', { type: 'TECHNICAL' }, cookie));
    expect(start.status).toBe(200);
    const startJson = await start.json();
    const questions = startJson.data.questions;
    expect(questions.length).toBe(8);
    expect(questions.every((q: any) => q.correct_key === null)).toBe(true);

    // 5) Kirim jawaban (dummy — hanya cek alur & skor numerik).
    const res = await submitTest(jsonReq('/x', {
      templateId: startJson.data.template.id,
      responses: questions.map((q: any) => ({ questionId: q.id, answerKey: q.options?.[0]?.key ?? 'A' })),
    }, cookie));
    expect(res.status).toBe(200);
    const resJson = await res.json();
    expect(typeof resJson.data.score).toBe('number');
    expect(resJson.data.total).toBe(8);
  });

  it('start tanpa type/templateId → 400', async () => {
    const res = await startTest(jsonReq('/x', {}, cookie));
    expect(res.status).toBe(400);
  });

  it('submit tanpa attempt → 404', async () => {
    // Template psikometri belum pernah di-start di alur ini → attempt tak ada.
    const psyTpl = 'c0000000-0000-4000-8000-000000000001';
    const res = await submitTest(jsonReq('/x', {
      templateId: psyTpl,
      responses: [{ questionId: 'c1000000-0000-4000-8000-000000000001', answerKey: '3' }],
    }, cookie));
    expect(res.status).toBe(404);
  });
});
