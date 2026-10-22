import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildStorageKey, deleteObject, getObject, isS3Configured, putObject, storageDriver,
} from '@/lib/storage/fileStorage';

describe('fileStorage — driver lokal', () => {
  let dir = '';

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'epq-storage-'));
    process.env.FILE_STORAGE_DIR = dir;
    delete process.env.S3_BUCKET;
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.FILE_STORAGE_DIR;
  });

  it('tanpa S3_BUCKET → driver lokal', () => {
    expect(isS3Configured()).toBe(false);
    expect(storageDriver()).toBe('local');
  });

  it('menyimpan lalu membaca kembali byte yang sama', async () => {
    const body = Buffer.from('%PDF-1.7\nisi uji\n%%EOF');
    const stored = await putObject('policies/uji.pdf', body, 'application/pdf');

    expect(stored.size).toBe(body.length);
    expect(stored.checksumSha256).toHaveLength(64);

    const read = await getObject('policies/uji.pdf');
    expect(read).not.toBeNull();
    expect(read!.contentType).toBe('application/pdf');
    expect(read!.body.equals(body)).toBe(true);
  });

  it('menulis ke disk dengan nama berkas yang aman', async () => {
    await putObject('policies/aman.pdf', Buffer.from('%PDF-1.7 x'), 'application/pdf');
    const files = readdirSync(join(dir, 'policies'));
    expect(files).toContain('aman.pdf');
  });

  it('menolak key dengan path traversal', async () => {
    await expect(putObject('../keluar.pdf', Buffer.from('x'), 'application/pdf'))
      .rejects.toThrow(/tidak valid/i);
  });

  it('menolak key absolut', async () => {
    await expect(putObject('/etc/passwd', Buffer.from('x'), 'application/pdf'))
      .rejects.toThrow(/tidak valid/i);
  });

  it('getObject untuk key tak ada → null (bukan melempar)', async () => {
    expect(await getObject('policies/tidak-ada.pdf')).toBeNull();
  });

  it('deleteObject menghapus berkas dan idempoten', async () => {
    await putObject('policies/hapus.pdf', Buffer.from('%PDF-1.7'), 'application/pdf');
    expect(existsSync(join(dir, 'policies', 'hapus.pdf'))).toBe(true);

    await deleteObject('policies/hapus.pdf');
    expect(existsSync(join(dir, 'policies', 'hapus.pdf'))).toBe(false);

    // Dipanggil dua kali tidak melempar.
    await expect(deleteObject('policies/hapus.pdf')).resolves.toBeUndefined();
  });

  it('isi berkas di disk identik dengan yang ditulis', async () => {
    const body = Buffer.from('%PDF-1.7 isi asli %%EOF');
    await putObject('policies/identik.pdf', body, 'application/pdf');
    expect(readFileSync(join(dir, 'policies', 'identik.pdf')).equals(body)).toBe(true);
  });
});

describe('buildStorageKey', () => {
  it('menyusun key dengan prefix dan nama aman', () => {
    const key = buildStorageKey('policies', 'SOP Cuti & Izin v2.pdf');
    expect(key).toMatch(/^policies\/[0-9a-f-]{36}-SOP-Cuti-Izin-v2\.pdf$/);
  });

  it('membuang komponen path dari nama berkas', () => {
    const key = buildStorageKey('policies', '../../etc/passwd.pdf');
    expect(key).not.toContain('..');
    expect(key.startsWith('policies/')).toBe(true);
  });

  it('mempertahankan ekstensi pdf', () => {
    expect(buildStorageKey('policies', 'a.PDF')).toMatch(/\.pdf$/);
  });
});
