/**
 * Uji adapter terhadap S3 SUNGGUHAN (SeaweedFS S3 gateway di 127.0.0.1:8333).
 * Dilewati bila endpoint tidak tersedia, agar tidak memerahkan suite di mesin lain.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { connect } from 'node:net';
import { putObject, getObject, deleteObject, isS3Configured, storageDriver } from '@/lib/storage/fileStorage';

function portOpen(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    const done = (ok: boolean) => { socket.destroy(); resolve(ok); };
    socket.setTimeout(1500, () => done(false));
    socket.on('connect', () => done(true));
    socket.on('error', () => done(false));
  });
}

const HOST = process.env.S3_ENDPOINT_HOST ?? '127.0.0.1';
const PORT = Number(process.env.S3_ENDPOINT_PORT ?? 8333);

const saved: Record<string, string | undefined> = {};

let available = false;

beforeAll(async () => {
  available = await portOpen(HOST, PORT);
  if (!available) return;

  for (const k of ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_ENDPOINT', 'S3_FORCE_PATH_STYLE']) {
    saved[k] = process.env[k];
  }
  process.env.S3_BUCKET = 'sop-files';
  process.env.S3_REGION = 'us-east-1';
  process.env.S3_ACCESS_KEY_ID = 'epqaccesskey';
  process.env.S3_SECRET_ACCESS_KEY = 'epqsecretkey1234567890';
  process.env.S3_ENDPOINT = `http://${HOST}:${PORT}`;
  process.env.S3_FORCE_PATH_STYLE = 'true';
});

describe('fileStorage terhadap S3 sungguhan', () => {
  it('driver S3 aktif', () => {
    if (!available) {
      console.warn('[skip] S3 gateway tidak tersedia di', `${HOST}:${PORT}`);
      return;
    }
    expect(isS3Configured()).toBe(true);
    expect(storageDriver()).toBe('s3');
  });

  it('round-trip PUT → GET → DELETE pada S3 sungguhan', async () => {
    if (!available) {
      console.warn('[skip] S3 gateway tidak tersedia');
      return;
    }

    const body = Buffer.from('%PDF-1.7\nisi uji s3 nyata\n%%EOF');
    const key = `policies/real-${Date.now()}.pdf`;

    const stored = await putObject(key, body, 'application/pdf');
    expect(stored.size).toBe(body.length);

    const read = await getObject(key);
    expect(read).not.toBeNull();
    expect(read!.body.equals(body)).toBe(true);

    await deleteObject(key);
    expect(await getObject(key)).toBeNull();
  });
});
