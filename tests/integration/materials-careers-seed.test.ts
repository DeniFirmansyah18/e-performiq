import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';

describe('materials/careers seed', () => {
  let client: PGlite;
  beforeAll(async () => { ({ client } = await createTestDb()); await runSeed(client); });
  afterAll(async () => { await client.close(); });

  const count = async (t: string) =>
    Number((await client.query<{ c: string }>(`SELECT count(*)::text AS c FROM ${t}`)).rows[0].c);

  it('membuat modul kursus termasuk minimal satu QUIZ', async () => {
    expect(await count('course_modules')).toBeGreaterThanOrEqual(6);
    const quiz = await client.query<{ c: string }>(`SELECT count(*)::text AS c FROM course_modules WHERE content_type='QUIZ'`);
    expect(Number(quiz.rows[0].c)).toBeGreaterThanOrEqual(1);
  });

  it('membuat lowongan publik + kandidat + lamaran + sertifikat', async () => {
    const pub = await client.query<{ c: string }>(`SELECT count(*)::text AS c FROM job_postings WHERE is_public = TRUE`);
    expect(Number(pub.rows[0].c)).toBeGreaterThanOrEqual(1);
    expect(await count('candidates')).toBeGreaterThanOrEqual(1);
    expect(await count('job_applications')).toBeGreaterThanOrEqual(1);
    expect(await count('certificates')).toBeGreaterThanOrEqual(1);
  });

  it('idempoten: seed kedua tidak menggandakan modul', async () => {
    const before = await count('course_modules');
    await runSeed(client);
    expect(await count('course_modules')).toBe(before);
  });
});
