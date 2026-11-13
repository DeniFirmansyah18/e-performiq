import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { listModules, getLesson, completeModule, submitQuiz } from '@/lib/services/courseContentService';
import type { Db } from '@/lib/db/client';

const BUDI = 'b0000000-0000-4000-8000-000000000004';

describe('courseContentService', () => {
  let client: PGlite; let db: Db;
  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  });
  afterAll(async () => { await client.close(); });

  const courseId = async (code: string) =>
    Number((await client.query<{ id: number }>(`SELECT id FROM moodle_courses WHERE course_code=$1`, [code])).rows[0].id);
  const moduleId = async (title: string) =>
    (await client.query<{ id: string }>(`SELECT id FROM course_modules WHERE title=$1`, [title])).rows[0].id;

  it('listModules mengembalikan modul kursus dengan contentType', async () => {
    const mods = await listModules(db, await courseId('ONB-101'), BUDI);
    expect(mods.length).toBeGreaterThanOrEqual(3);
    expect(mods.every((m) => !!m.contentType)).toBe(true);
    // Seeder menandai modul pertama ONB-101 sudah selesai untuk Budi.
    expect(mods[0].completed).toBe(true);
    expect(mods.slice(1).every((m) => m.completed === false)).toBe(true);
  });

  it('getLesson mengembalikan isi modul', async () => {
    const lesson = await getLesson(db, await moduleId('Mengenal Perusahaan'));
    expect(lesson.title).toBe('Mengenal Perusahaan');
  });

  it('submitQuiz menilai benar/salah', async () => {
    const quizId = await moduleId('Kuis Pemahaman Materi');
    // Jawab sesuai KUNCI yang tersimpan (bukan indeks tetap): kunci kursus
    // default dibuat dari materi sehingga posisi jawaban benar ada di indeks 0.
    const kunci = await client.query<{ quiz_key: Array<{ q: number; a: number }> }>(
      `SELECT quiz_key FROM course_modules WHERE id = $1`,
      [quizId]
    );
    const jawaban = (kunci.rows[0].quiz_key ?? []).sort((a, b) => a.q - b.q).map((k) => k.a);
    expect(jawaban.length).toBeGreaterThan(0);

    const pass = await submitQuiz(db, BUDI, quizId, jawaban);
    expect(pass.passed).toBe(true);
  });

  it('completeModule menandai modul selesai (idempoten)', async () => {
    const mid = await moduleId('Mengenal Perusahaan');
    const r1 = await completeModule(db, BUDI, mid);
    expect(r1.completed).toBe(true);
    await completeModule(db, BUDI, mid);
    const n = await client.query<{ c: string }>(`SELECT count(*)::text AS c FROM course_completions WHERE employee_id=$1::uuid AND module_id=$2`, [BUDI, mid]);
    expect(Number(n.rows[0].c)).toBe(1);
  });
});
