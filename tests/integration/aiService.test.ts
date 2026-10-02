import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { buildFeatureContext } from '@/lib/services/aiContext';
import { analyzeFeature, chat } from '@/lib/services/aiService';
import type { Db } from '@/lib/db/client';

describe('ai context + analyze + chat', () => {
  let client: PGlite; let db: Db;
  const OLD = process.env;
  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.AI_PROVIDER;
  });
  afterAll(async () => { await client.close(); process.env = OLD; vi.restoreAllMocks(); });

  it('buildFeatureContext executive mengembalikan objek dengan data', async () => {
    const ctx = await buildFeatureContext(db, 'executive');
    expect(typeof ctx).toBe('object');
    expect(Object.keys(ctx).length).toBeGreaterThan(0);
  });

  it('buildFeatureContext id tak dikenal tidak melempar', async () => {
    const ctx = await buildFeatureContext(db, 'unknown-xyz');
    expect(typeof ctx).toBe('object');
  });

  it('analyzeFeature tanpa kunci -> configured:false + insight non-kosong', async () => {
    const r = await analyzeFeature(db, 'executive', 'BOD');
    expect(r.configured).toBe(false);
    expect(r.insight.length).toBeGreaterThan(0);
  });

  it('chat tanpa kunci -> configured:false + reply non-kosong', async () => {
    const r = await chat(db, [{ role: 'user', content: 'halo' }], 'BOD');
    expect(r.configured).toBe(false);
    expect(r.reply.length).toBeGreaterThan(0);
  });
});
