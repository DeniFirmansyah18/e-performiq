import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';

vi.mock('@/lib/services/aiService', () => ({
  isAiConfigured: () => true,
  generateContent: vi.fn(async () => ({
    configured: true,
    text: JSON.stringify({ questions: [
      { prompt: 'Apa kompleksitas bubble sort?', options: { A: 'O(n)', B: 'O(n^2)', C: 'O(log n)', D: 'O(1)' }, correctKey: 'B', difficulty: 'MEDIUM' },
    ] }),
  })),
}));

import { generateTechnicalQuestions, approveQuestion, listDraftQuestions } from '@/lib/services/technicalTestGenerator';

describe('WS-4 AI tech-test generator', () => {
  let client: PGlite;
  let db: any;
  let postingId: string;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
    const q = await client.query<{ id: string }>(
      `SELECT id FROM job_postings WHERE required_skills IS NOT NULL AND jsonb_array_length(required_skills) > 0 LIMIT 1`,
    );
    postingId = q.rows[0].id;
  });
  afterAll(async () => { await client.close(); });

  it('generate menyimpan soal DRAFT + kembalikan jumlah', async () => {
    const r = await generateTechnicalQuestions(db, { positionId: postingId, count: 1 });
    expect(r.generated).toBeGreaterThanOrEqual(1);
    expect(r.questionIds.length).toBeGreaterThanOrEqual(1);
    const drafts = await listDraftQuestions(db, postingId);
    expect(drafts.length).toBeGreaterThanOrEqual(1);
    // DRAFT: belum aktif
    const chk = await client.query<{ is_active: boolean }>(
      `SELECT is_active FROM assessment_questions WHERE id = $1::uuid`, [drafts[0].id],
    );
    expect(chk.rows[0].is_active).toBe(false);
  });

  it('generate auto-buat template TECHNICAL khusus posisi (bukan generik)', async () => {
    const pos = await client.query<{ position_id: string }>(
      `SELECT position_id FROM job_postings WHERE id = $1::uuid`, [postingId],
    );
    const posId = pos.rows[0].position_id;
    // Template khusus posisi harus ada.
    const tpl = await client.query<{ id: string; position_id: string | null }>(
      `SELECT id, position_id FROM assessment_templates
        WHERE type = 'TECHNICAL'::assessment_type_enum AND position_id = $1::uuid`, [posId],
    );
    expect(tpl.rows.length).toBe(1);
    expect(tpl.rows[0].position_id).toBe(posId);
    // Soal hasil generate menempel ke template posisi, BUKAN template generik.
    const inGeneric = await client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM assessment_questions
        WHERE template_id = 'c0000000-0000-4000-8000-000000000002'::uuid AND source = 'AI'`,
    );
    expect(inGeneric.rows[0].n).toBe(0);
  });

  it('non-JSON AI atau kosong tidak crash (best-effort)', async () => {
    const { generateContent } = await import('@/lib/services/aiService');
    vi.mocked(generateContent).mockResolvedValueOnce({ configured: true, text: 'maaf, tidak bisa' });
    const r = await generateTechnicalQuestions(db, { positionId: postingId, count: 1 });
    expect(r.generated).toBe(0);
  });

  it('approve mengaktifkan soal', async () => {
    const drafts = await listDraftQuestions(db, postingId);
    expect(drafts.length).toBeGreaterThanOrEqual(1);
    await approveQuestion(db, drafts[0].id, { approvedBy: 'hr' });
    const active = await client.query<{ is_active: boolean }>(
      `SELECT is_active FROM assessment_questions WHERE id = $1::uuid`, [drafts[0].id],
    );
    expect(active.rows[0].is_active).toBe(true);
  });

  it('approve soal tak dikenal → 404 ramah', async () => {
    await expect(
      approveQuestion(db, '00000000-0000-4000-8000-000000000000', { approvedBy: 'hr' }),
    ).rejects.toThrow(/tidak ditemukan/i);
  });

  it('posisi tanpa skill → error ramah', async () => {
    await expect(
      generateTechnicalQuestions(db, { positionId: '00000000-0000-4000-8000-000000000000' }),
    ).rejects.toThrow(/kualifikasi|posisi/i);
  });
});
