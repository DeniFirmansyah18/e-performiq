/**
 * E2E: unggah PDF SOP lewat route asli dengan driver S3 + ClamAV aktif.
 * Dilewati bila S3 gateway atau clamscan tidak tersedia.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { connect } from 'node:net';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { POST as upload } from '@/app/api/v1/policies/upload/route';
import { POST as publish } from '@/app/api/v1/policies/route';
import { GET as download } from '@/app/api/v1/policies/[id]/file/route';

const HR_USER = 'e0000000-0000-4000-8000-000000000001';
const EMP_USER = 'e0000000-0000-4000-8000-000000000004';
const CLI = 'C:\\Program Files\\ClamAV\\clamscan.exe';
const DB = process.env.CLAMAV_DATABASE_DIR
  ?? join(process.env.LOCALAPPDATA ?? '', 'epq-clamav', 'database');

function portOpen(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = connect({ host, port });
    const done = (ok: boolean) => { s.destroy(); resolve(ok); };
    s.setTimeout(1500, () => done(false));
    s.on('connect', () => done(true));
    s.on('error', () => done(false));
  });
}

function pdf(pages = 2): Buffer {
  return Buffer.from(
    '%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
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

let available = false;
let hrCookie = '';
let empCookie = '';
let policyId = '';
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

beforeAll(async () => {
  const s3 = await portOpen('127.0.0.1', 8333);
  const clam = existsSync(CLI) && existsSync(DB);
  available = s3 && clam;
  if (!available) {
    console.warn('[skip] butuh S3 gateway 127.0.0.1:8333 dan clamscan+db');
    return;
  }

  process.env.S3_BUCKET = 'sop-files';
  process.env.S3_REGION = 'us-east-1';
  process.env.S3_ACCESS_KEY_ID = 'epqaccesskey';
  process.env.S3_SECRET_ACCESS_KEY = 'epqsecretkey1234567890';
  process.env.S3_ENDPOINT = 'http://127.0.0.1:8333';
  process.env.S3_FORCE_PATH_STYLE = 'true';
  process.env.CLAMAV_MODE = 'cli';
  process.env.CLAMAV_CLI_PATH = CLI;
  process.env.CLAMAV_DATABASE_DIR = DB;
  delete process.env.FILE_STORAGE_DIR;

  const client = await getDb();
  await runSeed(client);
  hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: HR_USER, employeeId: 'b0000000-0000-4000-8000-000000000001', role: 'HR_MANAGER', email: 'hr@eperformiq.co.id' })}`;
  empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: EMP_USER, employeeId: 'b0000000-0000-4000-8000-000000000004', role: 'EMPLOYEE', email: 'budi@eperformiq.co.id' })}`;
});

afterAll(() => {
  delete process.env.S3_BUCKET;
  delete process.env.S3_ENDPOINT;
});

describe('E2E unggah SOP — S3 + ClamAV aktif', () => {
  it('berkas bersih tersimpan di S3 dan dinyatakan CLEAN', async () => {
    if (!available) return;

    const res = await upload(uploadReq(new File([new Uint8Array(pdf())], 'SOP Cuti.pdf', { type: 'application/pdf' }), hrCookie));
    const body1 = await res.json();
    expect(res.status, `upload gagal: ${JSON.stringify(body1)}`).toBe(200);

    expect(body1.data.driver).toBe('s3');
    expect(body1.data.scanStatus).toBe('CLEAN');
    expect(body1.data.scanEngine).toBe('clamav');
    expect(body1.data.pageCount).toBe(2);
  });

  it('berkas berisi EICAR mentah ditolak lebih dulu oleh validasi PDF (400)', async () => {
    if (!available) return;

    // EICAR bukan PDF; validasi struktural menolaknya sebelum pemindai dipanggil.
    const eicar = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*', 'ascii');
    const res = await upload(uploadReq(new File([new Uint8Array(eicar)], 'jahat.pdf', { type: 'application/pdf' }), hrCookie));
    expect(res.status).toBe(400);
    expect(String((await res.json()).detail ?? '')).toMatch(/bukan PDF/i);
  });

  it('dokumen diterbitkan, lalu diunduh kembali dari S3 dengan byte identik', async () => {
    if (!available) return;

    const body = pdf(3);
    const up = await upload(uploadReq(new File([new Uint8Array(body)], 'SOP Arsip.pdf', { type: 'application/pdf' }), hrCookie));
    const upJson = await up.json();
    expect(up.status, `upload gagal: ${JSON.stringify(upJson)}`).toBe(200);

    const pub = await publish(
      new NextRequest('http://localhost:3000/api/v1/policies', {
        method: 'POST',
        headers: new Headers({ 'Content-Type': 'application/json', cookie: hrCookie }),
        body: JSON.stringify({
          documentCode: `SOP-S3-${stamp}`, title: 'SOP Arsip', policyType: 'SOP',
          version: '1.0', effectiveDate: '2026-10-01',
          storageKey: upJson.data.storageKey,
          fileName: upJson.data.fileName,
          fileSize: upJson.data.size,
          checksumSha256: upJson.data.checksumSha256,
          scanStatus: upJson.data.scanStatus,
          scanEngine: upJson.data.scanEngine,
          pageCount: upJson.data.pageCount,
        }),
      }),
    );
    expect(pub.status).toBe(200);
    policyId = (await pub.json()).data.id;

    const dl = await download(
      new NextRequest(`http://localhost:3000/api/v1/policies/${policyId}/file`, {
        headers: new Headers({ cookie: empCookie }),
      }),
      { params: { id: policyId } } as any,
    );
    expect(dl.status).toBe(200);

    const bytes = Buffer.from(await dl.arrayBuffer());
    expect(bytes.equals(body)).toBe(true);
  });
});
