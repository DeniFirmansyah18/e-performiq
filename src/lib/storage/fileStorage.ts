import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

export type StorageDriver = 's3' | 'local';

export interface StoredObject {
  key: string;
  size: number;
  contentType: string;
  checksumSha256: string;
}

export interface ReadObject {
  body: Buffer;
  contentType: string;
}

const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

/** Driver lokal tidak menyimpan metadata, jadi content-type disimpulkan dari ekstensi. */
function contentTypeFor(key: string): string {
  const match = key.toLowerCase().match(/\.[a-z0-9]+$/);
  return (match && CONTENT_TYPES[match[0]]) || DEFAULT_CONTENT_TYPE;
}

function localRoot(): string {
  return resolve(process.env.FILE_STORAGE_DIR ?? '.storage');
}

export function isS3Configured(): boolean {
  return Boolean(
    process.env.S3_BUCKET &&
    process.env.S3_REGION &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY,
  );
}

export function storageDriver(): StorageDriver {
  return isS3Configured() ? 's3' : 'local';
}

/**
 * Key hanya boleh berisi segmen aman. Menolak `..`, path absolut, dan karakter
 * Windows agar berkas tidak pernah keluar dari direktori penyimpanan.
 */
export function assertSafeKey(key: string): void {
  if (!key || key.length > 300) throw new Error('Key penyimpanan tidak valid.');
  if (key.includes('..') || key.startsWith('/') || key.startsWith('\\')) {
    throw new Error('Key penyimpanan tidak valid (path traversal).');
  }
  if (/[\\:*?"<>|]/.test(key)) {
    throw new Error('Key penyimpanan tidak valid (karakter terlarang).');
  }
  const segments = key.split('/');
  if (segments.some((s) => s === '' || s === '.' || s === '..')) {
    throw new Error('Key penyimpanan tidak valid (segmen kosong).');
  }
}

/** Nama berkas aman: hanya alfanumerik, titik, garis, garis bawah. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'berkas';
  const cleaned = base
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return cleaned.length > 0 ? cleaned.slice(0, 120) : 'berkas';
}

/** `policies/<uuid>-<nama-aman>.pdf` — UUID mencegah tabrakan nama. */
export function buildStorageKey(prefix: string, fileName: string): string {
  const safePrefix = prefix.replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'files';
  let safeName = sanitizeFileName(fileName);
  safeName = /\.pdf$/i.test(safeName)
    ? safeName.replace(/\.PDF$/i, '.pdf')
    : `${safeName}.pdf`;
  return `${safePrefix}/${randomUUID()}-${safeName}`;
}

function sha256(body: Buffer): string {
  return createHash('sha256').update(body).digest('hex');
}

function localPath(key: string): string {
  assertSafeKey(key);
  const root = localRoot();
  const target = resolve(root, key.split('/').join(sep));
  // Sabuk pengaman kedua: hasil resolve harus tetap di dalam root.
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error('Key penyimpanan tidak valid (di luar direktori).');
  }
  return target;
}

/* ------------------------------------------------------------------ */
/* Driver S3 (S3 / MinIO / R2 lewat endpoint override)                 */
/* ------------------------------------------------------------------ */

async function s3Client() {
  // Impor lambat: paket S3 hanya dimuat bila benar-benar dikonfigurasi.
  const { S3Client } = await import('@aws-sdk/client-s3');
  return new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
    },
  });
}

async function s3Put(key: string, body: Buffer, contentType: string): Promise<void> {
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const client = await s3Client();
  await client.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}

async function s3Get(key: string): Promise<ReadObject | null> {
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const client = await s3Client();
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
    if (!res.Body) return null;
    const bytes = await res.Body.transformToByteArray();
    return { body: Buffer.from(bytes), contentType: res.ContentType ?? DEFAULT_CONTENT_TYPE };
  } catch (err: any) {
    if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

async function s3Delete(key: string): Promise<void> {
  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
  const client = await s3Client();
  await client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
}

/* ------------------------------------------------------------------ */
/* API publik                                                          */
/* ------------------------------------------------------------------ */

export async function putObject(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
  assertSafeKey(key);

  if (storageDriver() === 's3') {
    await s3Put(key, body, contentType);
  } else {
    const target = localPath(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  return { key, size: body.length, contentType, checksumSha256: sha256(body) };
}

export async function getObject(key: string): Promise<ReadObject | null> {
  assertSafeKey(key);

  if (storageDriver() === 's3') return s3Get(key);

  const target = localPath(key);
  if (!existsSync(target)) return null;
  const body = await readFile(target);
  return { body, contentType: contentTypeFor(key) };
}

export async function deleteObject(key: string): Promise<void> {
  assertSafeKey(key);

  if (storageDriver() === 's3') {
    await s3Delete(key);
    return;
  }

  const target = localPath(key);
  if (existsSync(target)) await unlink(target);
}
