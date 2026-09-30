import { describe, it, expect } from 'vitest';
import { queryPolicyChatbotEngine } from '@/lib/services/helpdeskChatbotService';
import type { Db } from '@/lib/db/client';

/**
 * Unit test dengan DB tiruan (tanpa PGlite): memverifikasi perilaku source/confidence.
 * Cakupan terhadap DB nyata ada di tests/integration/chatbot-service.test.ts.
 */
function mockDb(kbRows: Array<{ question: string; answer: string; keywords: string }>, approvedLeaves = 0): Db {
  return {
    execute: async (query: any) => {
      const text = typeof query === 'string' ? query : JSON.stringify(query);
      if (text.includes('policy_knowledge_base')) return { rows: kbRows };
      if (text.includes('leave_requests')) return { rows: [{ used: approvedLeaves }] };
      return { rows: [] };
    },
  } as unknown as Db;
}

describe('Kotak 6: Policy Chatbot Engine (source/confidence)', () => {
  const KB = [
    { question: 'Bagaimana prosedur pengajuan cuti?', answer: 'Ajukan cuti lewat portal Kotak 4.', keywords: 'cuti,izin,tahunan' },
    { question: 'Bagaimana perhitungan pesangon?', answer: 'Sesuai PP No. 35/2021.', keywords: 'pesangon,phk,pensiun' },
  ];

  it('mengembalikan source POLICY untuk pertanyaan kebijakan yang cocok', async () => {
    const res = await queryPolicyChatbotEngine(mockDb(KB), 'prosedur pengajuan cuti tahunan', 'emp-1');
    expect(res.source).toBe('POLICY');
    expect(res.confidence).toBeGreaterThan(0);
  });

  it('mengembalikan source DATA untuk pertanyaan saldo cuti (data karyawan)', async () => {
    const res = await queryPolicyChatbotEngine(mockDb(KB, 3), 'berapa saldo cuti saya', 'emp-1');
    expect(res.source).toBe('DATA');
    expect(res.answer).toContain('3');
  });

  it('mengembalikan source FALLBACK untuk pertanyaan di luar topik', async () => {
    const res = await queryPolicyChatbotEngine(mockDb(KB), 'harga saham hari ini', 'emp-1');
    expect(res.source).toBe('FALLBACK');
    expect(res.confidence).toBe(0);
  });
});
