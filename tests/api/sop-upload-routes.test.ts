import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb, db as appDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { POST as upload } from '@/app/api/v1/policies/upload/route';
import { POST as publish } from '@/app/api/v1/policies/route';
import { GET as download } from '@/app/api/v1/policies/[id]/file/route';

const HR_USER = 'e0000000-0000-4000-8000-000000000001';
const EMP_USER = 'e0000000-0000-4000-8000-000000000004';

/** PDF minimal valid: header + trailer + /Count. */
function pdfBuffer(pages = 2): Buffer {
  return Buffer.from(
    '%PDF-1.7\n' +
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count ${pages} >>\nendobj\n` +
    '3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n' +
    'trailer\n<< /Root 1 0 R >>\n%%EOF\n',
    'latin1',
  );
}

function uploadReq(file: File, cookie: string): NextRequest {
  const form = new FormData();
  form.set('file', file);
  return new NextRequest('http://localhost:3000/api/v1/policies/upload', {
    method: 'POST',
    headers: new Headers({ cookie }),
    body: form,
  });
}

const jsonReq = (path: string, body: unknown, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: new Headers({ 'Content-Type': 'application/json', cookie }),
    body: JSON.stringify(body),
  });

describe('unggah & unduh berkas SOP', () => {
  let hrCookie = '';
  let empCookie = '';
  let dir = '';
  let storageKey = '';
  let policyId = '';
  const stamp = Date.now();

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'epq-sop-'));
    process.env.FILE_STORAGE_DIR = dir;
    delete process.env.S3_BUCKET;
    delete process.env.CLAMAV_HOST;

    const client = await getDb();
    await runSeed(client);

    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: HR_USER, employeeId: 'b0000000-0000-4000-8000-000000000001', role: 'HR_MANAGER', email: 'hr@eperformiq.co.id' })}`;
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: EMP_USER, employeeId: 'b0000000-0000-4000-8000-000000000004', role: 'EMPLOYEE', email: 'budi@eperformiq.co.id' })}`;
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.FILE_STORAGE_DIR;
  });

  it('karyawan tidak boleh mengunggah', async () => {
    const res = await upload(uploadReq(new File([new Uint8Array(pdfBuffer())], 'sop.pdf', { type: 'application/pdf' }), empCookie));
    expect(res.status).toBe(403);
  });

  it('menolak berkas bukan PDF', async () => {
    const res = await upload(uploadReq(new File([new Uint8Array(Buffer.from('halo dunia'))], 'sop.pdf', { type: 'application/pdf' }), hrCookie));
    expect(res.status).toBe(400);
    expect(String((await res.json()).detail ?? '')).toMatch(/bukan PDF/i);
  });

  it('menolak ekstensi selain .pdf', async () => {
    const res = await upload(uploadReq(new File([new Uint8Array(pdfBuffer())], 'sop.docx'), hrCookie));
    expect(res.status).toBe(415);
  });

  it('menolak berkas melebihi 10 MB', async () => {
    const big = Buffer.concat([pdfBuffer(), Buffer.alloc(11 * 1024 * 1024)]);
    const res = await upload(uploadReq(new File([new Uint8Array(big)], 'besar.pdf', { type: 'application/pdf' }), hrCookie));
    expect(res.status).toBe(413);
  });

  it('menolak PDF dengan halaman melebihi batas', async () => {
    const res = await upload(uploadReq(new File([new Uint8Array(pdfBuffer(900))], 'tebal.pdf', { type: 'application/pdf' }), hrCookie));
    expect(res.status).toBe(400);
    expect(String((await res.json()).detail ?? '')).toMatch(/halaman/i);
  });

  it('menerima PDF valid dan menyimpannya', async () => {
    const res = await upload(uploadReq(new File([new Uint8Array(pdfBuffer())], 'SOP Cuti.pdf', { type: 'application/pdf' }), hrCookie));
    expect(res.status).toBe(200);

    const json = await res.json();
    storageKey = json.data.storageKey;
    expect(storageKey).toMatch(/^policies\/[0-9a-f-]{36}-SOP-Cuti\.pdf$/);
    expect(json.data.size).toBeGreaterThan(0);
    expect(json.data.checksumSha256).toHaveLength(64);
    expect(json.data.scanStatus).toBe('SKIPPED');
    expect(json.data.pageCount).toBe(2);
  });

  it('menerbitkan dokumen memakai storageKey (bukan URL)', async () => {
    const res = await publish(jsonReq('/api/v1/policies', {
      documentCode: `SOP-UP-${stamp}`, title: 'SOP Unggah', policyType: 'SOP',
      version: '1.0', effectiveDate: '2026-10-01',
      storageKey, fileName: 'SOP Cuti.pdf', fileSize: 300, checksumSha256: 'a'.repeat(64),
      scanStatus: 'SKIPPED', scanEngine: 'none',
    }, hrCookie));
    expect(res.status).toBe(200);

    const json = await res.json();
    policyId = json.data.id;
    expect(json.data.fileUrl).toBe(`/api/v1/policies/${policyId}/file`);
  });

  it('menolak publikasi tanpa fileUrl maupun storageKey', async () => {
    const res = await publish(jsonReq('/api/v1/policies', {
      documentCode: `SOP-UP-${stamp}`, title: 'Tanpa berkas', policyType: 'SOP',
      version: '9.9', effectiveDate: '2026-10-01',
    }, hrCookie));
    expect(res.status).toBe(400);
  });

  it('unduh mengembalikan byte PDF yang sama', async () => {
    const res = await download(
      new NextRequest(`http://localhost:3000/api/v1/policies/${policyId}/file`, {
        headers: new Headers({ cookie: empCookie }),
      }),
      { params: { id: policyId } } as any,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');

    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.toString()).toContain('%%EOF');
  });

  it('unduh tanpa sesi → 401', async () => {
    const res = await download(
      new NextRequest(`http://localhost:3000/api/v1/policies/${policyId}/file`),
      { params: { id: policyId } } as any,
    );
    expect(res.status).toBe(401);
  });

  it('unduh dokumen tanpa berkas tersimpan → 404', async () => {
    const client = await getDb();
    const row = await client.query<{ id: string }>(
      `INSERT INTO policy_documents (document_code, title, policy_type, version, effective_date, file_url, status)
       VALUES ($1, 'Lama', 'SOP', '1.0', '2026-01-01', 'https://files.example.com/lama.pdf', 'AKTIF')
       RETURNING id`,
      [`SOP-URL-${stamp}`],
    );

    const res = await download(
      new NextRequest(`http://localhost:3000/api/v1/policies/${row.rows[0].id}/file`, {
        headers: new Headers({ cookie: empCookie }),
      }),
      { params: { id: row.rows[0].id } } as any,
    );
    expect(res.status).toBe(404);
  });
});
