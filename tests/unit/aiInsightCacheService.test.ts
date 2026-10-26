import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import type { Db } from '@/lib/db/client';
import {
  getCachedInsight,
  saveInsight,
  hashPayload,
} from '@/lib/services/aiInsightCacheService';

describe('AI Insight Cache', () => {
  let client: PGlite;
  let db: Db;

  const KEY = { feature: 'board', periodCode: '2026-Q3', role: 'BOD' };

  beforeAll(async () => {
    ({ client } = await createTestDb());
    db = drizzle(client) as unknown as Db;
  }, 60000);

  afterAll(async () => {
    await client.close();
  });

  it('mengembalikan null saat cache belum ada', async () => {
    const cached = await getCachedInsight(db, KEY);
    expect(cached).toBeNull();
  });

  it('menyimpan lalu membaca kembali cache', async () => {
    await saveInsight(db, {
      ...KEY,
      insight: 'Ringkasan kondisi korporat.',
      provider: 'groq',
      payloadHash: hashPayload({ a: 1 }),
    });

    const cached = await getCachedInsight(db, KEY);
    expect(cached?.insight).toBe('Ringkasan kondisi korporat.');
    expect(cached?.provider).toBe('groq');
    expect(cached?.payloadHash).toBe(hashPayload({ a: 1 }));
    expect(Number.isNaN(Date.parse(cached!.generatedAt))).toBe(false);
  });

  it('penyimpanan kedua menimpa baris yang sama, bukan menggandakan', async () => {
    await saveInsight(db, {
      ...KEY,
      insight: 'Versi kedua.',
      provider: 'gemini',
      payloadHash: hashPayload({ a: 2 }),
    });

    const cached = await getCachedInsight(db, KEY);
    expect(cached?.insight).toBe('Versi kedua.');
    expect(cached?.provider).toBe('gemini');

    const count = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM ai_insights WHERE feature = 'board'`
    );
    expect(count.rows[0].n).toBe(1);
  });

  it('cache dipisah per periode dan peran', async () => {
    const other = await getCachedInsight(db, { ...KEY, periodCode: '2026-Q4' });
    expect(other).toBeNull();

    const otherRole = await getCachedInsight(db, { ...KEY, role: 'HR_MANAGER' });
    expect(otherRole).toBeNull();
  });

  it('hashPayload stabil terhadap urutan kunci', async () => {
    expect(hashPayload({ b: 2, a: 1 })).toBe(hashPayload({ a: 1, b: 2 }));
  });

  it('hashPayload berubah saat nilai berubah', async () => {
    expect(hashPayload({ a: 1 })).not.toBe(hashPayload({ a: 2 }));
  });

  it('hashPayload menangani null, array, dan nilai bersarang', async () => {
    expect(hashPayload(null)).toHaveLength(64);
    expect(hashPayload([1, { z: 2, a: 3 }])).toBe(hashPayload([1, { a: 3, z: 2 }]));
    expect(hashPayload({ x: undefined })).toHaveLength(64);
  });
});
