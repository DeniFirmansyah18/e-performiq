import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { deleteObject, getObject, isS3Configured, putObject, storageDriver } from '@/lib/storage/fileStorage';

/**
 * Server S3 palsu: cukup untuk membuktikan driver benar-benar mengirim
 * PUT/GET/DELETE bertanda tangan SigV4 ke endpoint yang dikonfigurasi.
 * Bukan pengganti uji terhadap MinIO/S3 sungguhan.
 */
function startFakeS3(): Promise<{ server: Server; objects: Map<string, Buffer>; authHeaders: string[] }> {
  const objects = new Map<string, Buffer>();
  const authHeaders: string[] = [];

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c as Buffer));
    req.on('end', () => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      // Path style: /<bucket>/<key...>
      const key = decodeURIComponent(url.pathname.replace(/^\/[^/]+\//, ''));
      authHeaders.push(String(req.headers.authorization ?? ''));

      if (req.method === 'PUT') {
        objects.set(key, Buffer.concat(chunks));
        res.writeHead(200, { ETag: '"fake"' }).end();
        return;
      }
      if (req.method === 'GET') {
        const body = objects.get(key);
        if (!body) { res.writeHead(404).end(); return; }
        res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': String(body.length) }).end(body);
        return;
      }
      if (req.method === 'DELETE') {
        objects.delete(key);
        res.writeHead(204).end();
        return;
      }
      res.writeHead(405).end();
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, objects, authHeaders }));
  });
}

describe('fileStorage — driver S3', () => {
  let server: Server;
  let objects: Map<string, Buffer>;
  let authHeaders: string[];
  const saved: Record<string, string | undefined> = {};

  beforeAll(async () => {
    ({ server, objects, authHeaders } = await startFakeS3());
    const port = (server.address() as AddressInfo).port;

    for (const k of ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_ENDPOINT']) {
      saved[k] = process.env[k];
    }
    process.env.S3_BUCKET = 'sop-files';
    process.env.S3_REGION = 'us-east-1';
    process.env.S3_ACCESS_KEY_ID = 'AKIAFAKEFAKEFAKEFAKE';
    process.env.S3_SECRET_ACCESS_KEY = 'fake/secret/key/for/test';
    process.env.S3_ENDPOINT = `http://127.0.0.1:${port}`;
    process.env.S3_FORCE_PATH_STYLE = 'true';
  });

  afterAll(async () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('mengaktifkan driver S3 saat kredensial lengkap', () => {
    expect(isS3Configured()).toBe(true);
    expect(storageDriver()).toBe('s3');
  });

  it('PUT mengirim objek ke endpoint dan menandatangani dengan SigV4', async () => {
    const body = Buffer.from('%PDF-1.7 isi sop %%EOF');
    const stored = await putObject('policies/s3-uji.pdf', body, 'application/pdf');

    expect(stored.size).toBe(body.length);
    expect(objects.get('policies/s3-uji.pdf')?.equals(body)).toBe(true);
    expect(authHeaders.at(-1)).toMatch(/^AWS4-HMAC-SHA256 Credential=/);
  });

  it('GET membaca kembali objek dari endpoint', async () => {
    const read = await getObject('policies/s3-uji.pdf');
    expect(read).not.toBeNull();
    expect(read!.contentType).toBe('application/pdf');
    expect(read!.body.toString()).toContain('isi sop');
  });

  it('GET objek tak ada → null', async () => {
    expect(await getObject('policies/hilang.pdf')).toBeNull();
  });

  it('DELETE menghapus objek', async () => {
    await deleteObject('policies/s3-uji.pdf');
    expect(objects.has('policies/s3-uji.pdf')).toBe(false);
    expect(await getObject('policies/s3-uji.pdf')).toBeNull();
  });

  it('tetap menolak key dengan path traversal walau driver S3', async () => {
    await expect(putObject('../luar.pdf', Buffer.from('x'), 'application/pdf'))
      .rejects.toThrow(/tidak valid/i);
  });
});
