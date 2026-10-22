import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { resetRateLimit } from '@/lib/api/rateLimit';
import { POST as upload } from '@/app/api/v1/policies/upload/route';
import { POST as coach } from '@/app/api/v1/ai/performance-coach/route';

const HR_USER = 'e0000000-0000-4000-8000-000000000001';

function pdf(): Buffer {
  return Buffer.from(
    '%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
    '3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n' +
    'trailer\n<< /Root 1 0 R >>\n%%EOF\n',
    'latin1',
  );
}

function uploadReq(cookie: string): NextRequest {
  const form = new FormData();
  form.set('file', new File([new Uint8Array(pdf())], 'sop.pdf', { type: 'application/pdf' }));
  return new NextRequest('http://localhost:3000/api/v1/policies/upload', {
    method: 'POST',
    headers: new Headers({ cookie }),
    body: form,
  });
}

const coachReq = (cookie: string) =>
  new NextRequest('http://localhost:3000/api/v1/ai/performance-coach', {
    method: 'POST',
    headers: new Headers({ 'Content-Type': 'application/json', cookie }),
    body: JSON.stringify({ question: 'kenapa status saya merah?' }),
  });

describe('rate limit pada endpoint mahal', () => {
  let hrCookie = '';

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: HR_USER, employeeId: 'b0000000-0000-4000-8000-000000000001', role: 'HR_MANAGER', email: 'hr@eperformiq.co.id' })}`;
  });

  beforeEach(() => {
    resetRateLimit();
    delete process.env.FILE_STORAGE_DIR;
    delete process.env.S3_BUCKET;
  });

  it('unggah: permintaan ke-11 ditolak 429 dalam satu jendela', async () => {
    let last: Response | null = null;
    for (let i = 0; i < 11; i++) {
      last = await upload(uploadReq(hrCookie));
    }
    expect(last!.status).toBe(429);
    expect(last!.headers.get('Retry-After')).toBeTruthy();
    expect(last!.headers.get('X-RateLimit-Limit')).toBe('10');
  });

  it('unggah: 10 permintaan pertama tidak terkena 429', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await upload(uploadReq(hrCookie));
      expect(res.status).not.toBe(429);
    }
  });

  it('AI coach: permintaan ke-21 ditolak 429', async () => {
    let last: Response | null = null;
    for (let i = 0; i < 21; i++) {
      last = await coach(coachReq(hrCookie));
    }
    expect(last!.status).toBe(429);
    expect(last!.headers.get('X-RateLimit-Limit')).toBe('20');
  });
});
