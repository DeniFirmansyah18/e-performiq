import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { queryPolicyChatbotEngine } from '@/lib/services/helpdeskChatbotService';
import type { Db } from '@/lib/db/client';

describe('governance chatbot engine', () => {
  let client: PGlite; let db: Db;
  const BUDI = 'b0000000-0000-4000-8000-000000000004';
  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  });
  afterAll(async () => { await client.close(); });

  it('menjawab pertanyaan kebijakan dari knowledge base (source POLICY)', async () => {
    const res = await queryPolicyChatbotEngine(db, 'bagaimana prosedur pengajuan cuti tahunan?', BUDI);
    expect(res.source).toBe('POLICY');
    expect(res.confidence).toBeGreaterThan(0);
    expect(res.answer.length).toBeGreaterThan(10);
  });

  it('mengembalikan FALLBACK untuk pertanyaan di luar topik', async () => {
    const res = await queryPolicyChatbotEngine(db, 'harga saham perusahaan hari ini berapa?', BUDI);
    expect(res.source).toBe('FALLBACK');
  });

  it('menjawab pertanyaan data (saldo cuti) dengan source DATA untuk karyawan yang meminta', async () => {
    const res = await queryPolicyChatbotEngine(db, 'berapa saldo cuti saya?', BUDI);
    expect(res.source).toBe('DATA');
  });
});
