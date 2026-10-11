import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import {
  generatePositionOnboardingCourse,
  fallbackModules,
  parseModules,
} from '@/lib/services/onboardingProgramAiService';

// Posisi Senior Software Engineer (a0000000-...-0204 → kode ONB-A0000000).
const POS_SWE = 'a0000000-0000-4000-8000-000000000204';

describe('Onboarding Program AI — kurikulum per-posisi nyata (bukan demo)', () => {
  let client: PGlite;
  let db: any;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
  });
  afterAll(async () => { await client.close(); });

  it('fallback deterministik berisi modul materi + kuis berkunci + materi OER', () => {
    const mods = fallbackModules({ positionTitle: 'Software Engineer', department: 'IT', requiredSkills: ['TypeScript'] });
    expect(mods.length).toBeGreaterThanOrEqual(3);
    const quiz = mods.find((m) => m.contentType === 'QUIZ');
    expect(quiz).toBeTruthy();
    expect(Array.isArray(quiz!.quizKey)).toBe(true);
    expect(quiz!.quizKey!.length).toBeGreaterThan(0);
    // Modul OER (VIDEO) dengan tautan https dari domain tepercaya.
    const oer = mods.filter((m) => m.contentType === 'VIDEO' || m.contentType === 'PDF');
    expect(oer.length).toBeGreaterThan(0);
    expect(oer.every((m) => typeof m.contentUrl === 'string' && m.contentUrl!.startsWith('https://'))).toBe(true);
  });

  it('parseModules menurunkan VIDEO/PDF tanpa tautan tepercaya menjadi TEXT', () => {
    const ctx = { positionTitle: 'SE', department: null, requiredSkills: [] };
    const raw = JSON.stringify([
      { title: 'Video tanpa tautan', contentType: 'VIDEO', contentBody: 'isi', contentUrl: null },
      { title: 'Video domain asing', contentType: 'VIDEO', contentBody: 'isi', contentUrl: 'https://evil.example.com/v' },
      { title: 'Video tepercaya', contentType: 'VIDEO', contentBody: 'isi', contentUrl: 'https://learn.microsoft.com/en-us/training/paths/react/' },
      { title: 'Kuis', contentType: 'QUIZ', contentBody: '{"questions":[{"text":"Q?","options":["a","b"]}]}', quizKey: [{ q: 1, a: 0 }] },
    ]);
    const parsed = parseModules(raw, ctx);
    expect(parsed[0].contentType).toBe('TEXT'); // diturunkan
    expect(parsed[0].contentUrl).toBeNull();
    expect(parsed[1].contentType).toBe('TEXT'); // diturunkan
    expect(parsed[2].contentType).toBe('VIDEO'); // dipertahankan
    expect(parsed[2].contentUrl).toBe('https://learn.microsoft.com/en-us/training/paths/react/');
  });

  it('parseModules menolak keluaran tak valid → fallback; menerima JSON array valid', () => {
    const ctx = { positionTitle: 'SE', department: null, requiredSkills: [] };
    expect(parseModules('bukan json sama sekali', ctx).length).toBeGreaterThanOrEqual(3);

    const aiRaw = '```json\n[{"title":"Orientasi","contentType":"TEXT","contentBody":"isi"},\n' +
      '{"title":"Kuis","contentType":"QUIZ","contentBody":"{\\"questions\\":[{\\"text\\":\\"Q1?\\",\\"options\\":[\\"a\\",\\"b\\"]},{\\"text\\":\\"Q2?\\",\\"options\\":[\\"a\\",\\"b\\"]},{\\"text\\":\\"Q3?\\",\\"options\\":[\\"a\\",\\"b\\"]}]}","quizKey":[{"q":1,"a":0},{"q":2,"a":1},{"q":3,"a":0}]}]```';
    const parsed = parseModules(aiRaw, ctx);
    expect(parsed.length).toBe(2);
    expect(parsed[1].contentType).toBe('QUIZ');
    expect(parsed[1].quizKey).toEqual([{ q: 1, a: 0 }, { q: 2, a: 1 }, { q: 3, a: 0 }]);
    // Soal tersimpan di content_body (tanpa kunci jawaban yang bocor).
    const body = JSON.parse(parsed[1].contentBody as string);
    expect(body.questions.length).toBe(3);
    expect(body.questions[0].text).toBe('Q1?');
  });

  it('generate (useAi:false) membuat kursus ONB + modul + tautan posisi, idempoten', async () => {
    const gen = await generatePositionOnboardingCourse(db, POS_SWE, { useAi: false });
    expect(gen).toBeTruthy();
    expect(gen!.courseCode).toBe('ONB-A0000000');
    expect(gen!.created).toBe(true);
    expect(gen!.aiUsed).toBe(false);

    // Kursus persisted, fase PRE, mandatori.
    const course = await client.query<{ id: number; target_phase: string; is_mandatory: boolean }>(
      `SELECT id, target_phase, is_mandatory FROM moodle_courses WHERE course_code = $1`, [gen!.courseCode],
    );
    expect(course.rows[0].target_phase).toBe('PRE');
    expect(course.rows[0].is_mandatory).toBe(true);

    // Modul persisted termasuk minimal satu QUIZ dengan quiz_key.
    const mods = await client.query<{ content_type: string; quiz_key: any }>(
      `SELECT content_type, quiz_key FROM course_modules WHERE course_id = $1 ORDER BY order_index`, [course.rows[0].id],
    );
    expect(mods.rows.length).toBeGreaterThanOrEqual(3);
    const quiz = mods.rows.find((m) => m.content_type === 'QUIZ');
    expect(quiz).toBeTruthy();
    expect(Array.isArray(quiz!.quiz_key)).toBe(true);
    expect(quiz!.quiz_key.length).toBeGreaterThan(0);

    // Tautan posisi WAJIB.
    const link = await client.query<{ is_mandatory: boolean }>(
      `SELECT is_mandatory FROM position_courses WHERE position_id = $1::uuid AND course_id = $2`, [POS_SWE, course.rows[0].id],
    );
    expect(link.rows[0].is_mandatory).toBe(true);

    // Idempoten: pemanggilan kedua tak menduplikasi kursus/modul.
    const gen2 = await generatePositionOnboardingCourse(db, POS_SWE, { useAi: false });
    expect(gen2!.created).toBe(false);
    expect(gen2!.courseId).toBe(gen!.courseId);
    const dup = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM moodle_courses WHERE course_code = $1`, [gen!.courseCode],
    );
    expect(Number(dup.rows[0].n)).toBe(1);
    const mods2 = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM course_modules WHERE course_id = $1`, [gen!.courseId],
    );
    expect(Number(mods2.rows[0].n)).toBe(mods.rows.length);
  });

  it('posisi tak dikenal → null (tanpa efek samping)', async () => {
    const gen = await generatePositionOnboardingCourse(db, 'ffffffff-ffff-4fff-8fff-ffffffffffff', { useAi: false });
    expect(gen).toBeNull();
  });
});
