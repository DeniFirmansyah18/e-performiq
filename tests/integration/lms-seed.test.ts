import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';

describe('LMS seed data', () => {
  let client: PGlite;
  beforeAll(async () => { ({ client } = await createTestDb()); await runSeed(client); });
  afterAll(async () => { await client.close(); });

  const count = async (t: string) =>
    Number((await client.query<{ c: string }>(`SELECT count(*)::text AS c FROM ${t}`)).rows[0].c);

  it('membuat minimal 2 framework dan 6 kompetensi', async () => {
    expect(await count('competency_frameworks')).toBeGreaterThanOrEqual(2);
    expect(await count('competencies')).toBeGreaterThanOrEqual(6);
  });

  it('membuat minimal 6 kursus dengan satu kursus per fase PRE/DURING/POST', async () => {
    expect(await count('moodle_courses')).toBeGreaterThanOrEqual(6);
    for (const phase of ['PRE', 'DURING', 'POST']) {
      const r = await client.query<{ c: string }>(
        `SELECT count(*)::text AS c FROM moodle_courses WHERE target_phase = $1`, [phase]);
      expect(Number(r.rows[0].c), `no course for ${phase}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('membuat badge + criteria + learning plan', async () => {
    expect(await count('badges')).toBeGreaterThanOrEqual(2);
    expect(await count('badge_criteria')).toBeGreaterThanOrEqual(2);
    expect(await count('learning_plans')).toBeGreaterThanOrEqual(1);
    expect(await count('learning_plan_items')).toBeGreaterThanOrEqual(2);
  });

  it('idempoten: seed kedua tidak menggandakan baris', async () => {
    const before = await count('moodle_courses');
    await runSeed(client);
    expect(await count('moodle_courses')).toBe(before);
  });
});
