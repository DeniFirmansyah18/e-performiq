import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { signSession } from '@/lib/auth/session';
import { NextRequest } from 'next/server';
import { GET as statusGet } from '@/app/api/v1/ai/status/route';
import { POST as analyzePost } from '@/app/api/v1/ai/analyze/route';
import { POST as chatPost } from '@/app/api/v1/ai/chat/route';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const BUDI_USER = 'e0000000-0000-4000-8000-000000000004';

function req(path: string, token?: string, body?: unknown): NextRequest {
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (body) headers.set('Content-Type', 'application/json');
  return new NextRequest(`http://localhost:3000${path}`, {
    method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined,
  });
}

describe('AI routes', () => {
  let client: PGlite;
  beforeAll(async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.AI_PROVIDER;
    ({ client } = await createTestDb());
    await runSeed(client);
  });
  afterAll(async () => { await client.close(); });

  it('GET /ai/status 401 tanpa sesi; 200 configured:false dengan sesi', async () => {
    expect((await statusGet(req('/x'))).status).toBe(401);
    const token = await signSession({ userId: BUDI_USER, employeeId: BUDI, role: 'EMPLOYEE', email: 'budi@x.id' });
    const res = await statusGet(req('/x', token));
    expect(res.status).toBe(200);
    expect((await res.json()).data.configured).toBe(false);
  });

  it('POST /ai/analyze 401 tanpa sesi; 400 tanpa feature; 200 tanpa kunci', async () => {
    expect((await analyzePost(req('/x', undefined, { feature: 'executive' }))).status).toBe(401);
    const token = await signSession({ userId: BUDI_USER, employeeId: BUDI, role: 'EMPLOYEE', email: 'budi@x.id' });
    expect((await analyzePost(req('/x', token, {}))).status).toBe(400);
    const ok = await analyzePost(req('/x', token, { feature: 'executive' }));
    expect(ok.status).toBe(200);
    const json = await ok.json();
    expect(json.data.configured).toBe(false);
    expect(json.data.insight.length).toBeGreaterThan(0);
  });

  it('POST /ai/chat 400 untuk messages kosong; 200 tanpa kunci', async () => {
    const token = await signSession({ userId: BUDI_USER, employeeId: BUDI, role: 'EMPLOYEE', email: 'budi@x.id' });
    expect((await chatPost(req('/x', token, { messages: [] }))).status).toBe(400);
    const ok = await chatPost(req('/x', token, { messages: [{ role: 'user', content: 'halo' }] }));
    expect(ok.status).toBe(200);
    const json = await ok.json();
    expect(json.data.reply.length).toBeGreaterThan(0);
  });
});
