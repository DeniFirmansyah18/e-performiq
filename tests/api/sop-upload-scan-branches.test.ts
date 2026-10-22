import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';

// Pemindai di-mock agar cabang INFECTED dan SCANNER_UNAVAILABLE dapat diuji
// tanpa bergantung pada clamd/clamscan di mesin uji.
vi.mock('@/lib/storage/scanFile', () => ({
  clamavConfigured: () => true,
  scanBuffer: vi.fn(),
}));

import { scanBuffer } from '@/lib/storage/scanFile';
import { POST as upload } from '@/app/api/v1/policies/upload/route';

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

describe('route unggah — cabang pemindaian', () => {
  let hrCookie = '';

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: HR_USER, employeeId: 'b0000000-0000-4000-8000-000000000001', role: 'HR_MANAGER', email: 'hr@eperformiq.co.id' })}`;
  });

  beforeEach(() => {
    delete process.env.SOP_UPLOAD_REQUIRE_SCAN;
    delete process.env.FILE_STORAGE_DIR;
  });

  it('pemindai menemukan malware → 422 dan berkas tidak disimpan', async () => {
    vi.mocked(scanBuffer).mockResolvedValue({
      status: 'INFECTED', engine: 'clamav', signature: 'Eicar-Test-Signature',
    });

    const res = await upload(uploadReq(hrCookie));
    expect(res.status).toBe(422);
    expect(String((await res.json()).detail ?? '')).toMatch(/pemindai.*Eicar/i);
  });

  it('pemindai tidak tersedia & tidak diwajibkan → 200 dengan SKIPPED', async () => {
    vi.mocked(scanBuffer).mockResolvedValue({
      status: 'SKIPPED', engine: 'none', reason: 'ClamAV tidak dikonfigurasi.',
    });

    const res = await upload(uploadReq(hrCookie));
    expect(res.status).toBe(200);
    expect((await res.json()).data.scanStatus).toBe('SKIPPED');
  });

  it('pemindai tidak tersedia & diwajibkan → 503', async () => {
    process.env.SOP_UPLOAD_REQUIRE_SCAN = '1';
    vi.mocked(scanBuffer).mockResolvedValue({
      status: 'SKIPPED', engine: 'none', reason: 'ClamAV tidak dikonfigurasi.',
    });

    const res = await upload(uploadReq(hrCookie));
    expect(res.status).toBe(503);
    expect(String((await res.json()).detail ?? '')).toMatch(/mewajibkan pemindaian/i);
  });

  it('pemindai bersih → 200 dan CLEAN tercatat', async () => {
    vi.mocked(scanBuffer).mockResolvedValue({ status: 'CLEAN', engine: 'clamav' });

    const res = await upload(uploadReq(hrCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.scanStatus).toBe('CLEAN');
    expect(json.data.scanEngine).toBe('clamav');
  });
});
