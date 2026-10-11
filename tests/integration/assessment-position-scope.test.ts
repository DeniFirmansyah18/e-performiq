/**
 * Scoping asesmen per posisi: kandidat hanya boleh melihat/mengerjakan template
 * posisi yang dilamar (atau template generik). Mencegah soal Software Engineer
 * tercampur ke Digital Marketing.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { listTemplates, getTemplateForType } from '@/lib/services/assessmentService';

const POS_A = 'a0000000-0000-4000-8000-000000000204';
const POS_B = 'a0000000-0000-4000-8000-000000000207';

describe('Scoping template asesmen per posisi', () => {
  let client: PGlite;
  let db: any;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
    // Dua template TECHNICAL spesifik posisi berbeda.
    await client.query(
      `INSERT INTO assessment_templates (id, code, title, type, weight, description, is_active, position_id)
       VALUES ('d0000000-0000-4000-8000-0000000000a1','TECH-A','Tes Teknis Software Engineer','TECHNICAL',40,'x',TRUE,$1::uuid),
              ('d0000000-0000-4000-8000-0000000000a2','TECH-B','Tes Teknis Digital Marketing','TECHNICAL',40,'y',TRUE,$2::uuid)
       ON CONFLICT (id) DO NOTHING`,
      [POS_A, POS_B],
    );
  });
  afterAll(async () => { await client.close(); });

  it('listTemplates(position A) tidak memuat template posisi B', async () => {
    const tpls = await listTemplates(db, POS_A);
    const codes = tpls.map((t) => t.code);
    expect(codes).toContain('TECH-A');
    expect(codes).not.toContain('TECH-B');
    // Tes teknis wajib khusus posisi → template teknis generik tidak boleh terlihat.
    expect(codes).not.toContain('TECH-GEN');
    // Psikometri/wawancara generik tetap boleh terlihat.
    expect(codes).toContain('PSY-BIG5');
    expect(codes).toContain('INTV-STRUCT');
  });

  it('getTemplateForType(TECHNICAL, A) memilih template posisi A', async () => {
    const tpl = await getTemplateForType(db, 'TECHNICAL', POS_A);
    expect(tpl?.code).toBe('TECH-A');
  });

  it('getTemplateForType(TECHNICAL, B) memilih template posisi B', async () => {
    const tpl = await getTemplateForType(db, 'TECHNICAL', POS_B);
    expect(tpl?.code).toBe('TECH-B');
  });

  it('tanpa positionId tetap kompatibel (kembalikan template)', async () => {
    const tpl = await getTemplateForType(db, 'TECHNICAL');
    expect(tpl).toBeTruthy();
  });
});
