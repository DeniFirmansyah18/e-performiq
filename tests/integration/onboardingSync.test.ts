import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { generateOnboardingProgram, getOnboardingStatus, listPositionCourses } from '@/lib/services/onboardingService';

let client: PGlite;
let db: Db;
/** Pegawai Senior Software Engineer. */
let empSWE = '';
let posSWE = '';
let empCEO = '';
let posCEO = '';

beforeAll(async () => {
  ({ client } = await createTestDb());
  await runSeed(client);
  db = drizzle(client) as unknown as Db;

  const a = await client.query<{ id: string; pos: string }>(`
    SELECT e.id::text AS id, e.position_id::text AS pos
      FROM employees e JOIN job_positions p ON p.id = e.position_id
     WHERE p.position_title ILIKE '%Senior Software%' AND e.status IN ('PERMANENT','PROBATION')
     LIMIT 1`);
  empSWE = a.rows[0].id;
  posSWE = a.rows[0].pos;

  const b = await client.query<{ id: string; pos: string }>(`
    SELECT e.id::text AS id, e.position_id::text AS pos
      FROM employees e JOIN job_positions p ON p.id = e.position_id
     WHERE p.position_title ILIKE '%Chief Executive%'
     LIMIT 1`);
  empCEO = b.rows[0].id;
  posCEO = b.rows[0].pos;
}, 60000);

afterAll(async () => {
  await client.close();
});

/** Judul kursus onboarding milik sebuah posisi. */
async function judulOnboardingPosisi(positionId: string): Promise<string[]> {
  const r = await client.query<{ title: string }>(`
    SELECT mc.title FROM position_courses pc
      JOIN moodle_courses mc ON mc.id = pc.course_id
     WHERE pc.position_id = $1::uuid AND mc.title ILIKE 'Onboarding %'
  `, [positionId]);
  return r.rows.map((x) => x.title);
}

describe('onboarding pegawai hanya memuat kursus sesuai posisinya', () => {
  it('kursus onboarding tiap posisi berbeda dan menyebut nama posisinya', async () => {
    // Picu generate dulu: kursus onboarding per posisi dibuat saat generate.
    await generateOnboardingProgram(db, { employeeId: empSWE });
    await generateOnboardingProgram(db, { employeeId: empCEO });

    const swe = await judulOnboardingPosisi(posSWE);
    const ceo = await judulOnboardingPosisi(posCEO);
    expect(swe.some((t) => /Senior Software Engineer/i.test(t)), `kursus SWE: ${swe.join(', ')}`).toBe(true);
    expect(ceo.some((t) => /Chief Executive/i.test(t)), `kursus CEO: ${ceo.join(', ')}`).toBe(true);
    // Tidak boleh ada kursus onboarding posisi lain.
    expect(ceo.some((t) => /Senior Software/i.test(t)), 'CEO tidak boleh dapat kursus SWE').toBe(false);
  });

  it('setelah generate program, onboarding pegawai tidak memuat kursus posisi lain', async () => {
    await generateOnboardingProgram(db, { employeeId: empSWE });
    const status = await getOnboardingStatus(db, empSWE);

    const judul = status.items.map((i) => String(i.title ?? ''));
    const onb = judul.filter((t) => /^Onboarding /i.test(t));
    expect(onb.length, 'ada kursus onboarding').toBeGreaterThan(0);

    // Tidak ada kursus onboarding yang menyebut posisi LAIN.
    const bocor = onb.filter((t) => /^Onboarding (?!101)/i.test(t) && !/Senior Software Engineer/i.test(t));
    expect(bocor, `kursus posisi lain ikut muncul: ${bocor.join(' | ')}`).toEqual([]);
  });

  it('kursus default (Onboarding 101 & AKHLAK) tetap ikut untuk semua posisi', async () => {
    const status = await getOnboardingStatus(db, empSWE);
    const judul = status.items.map((i) => String(i.title ?? ''));
    expect(judul.some((t) => /Onboarding 101/i.test(t))).toBe(true);
    expect(judul.some((t) => /AKHLAK/i.test(t))).toBe(true);
  });

  it('kursus default punya materi dan kuis yang kuncinya sesuai jumlah soal', async () => {
    for (const kode of ['ONB-101', 'AKHLAK-CULTURE']) {
      const c = await client.query<{ id: number }>('SELECT id FROM moodle_courses WHERE course_code = $1', [kode]);
      expect(c.rows.length, `${kode} ada`).toBe(1);

      const mods = await client.query<{ title: string; content_type: string; content_body: string; quiz_key: any }>(
        'SELECT title, content_type, content_body, quiz_key FROM course_modules WHERE course_id = $1 ORDER BY order_index',
        [c.rows[0].id]
      );
      expect(mods.rows.length, `${kode} punya modul`).toBeGreaterThanOrEqual(4);

      const kuis = mods.rows.find((m) => m.content_type === 'QUIZ');
      expect(kuis, `${kode} punya modul QUIZ`).toBeTruthy();

      const isi = JSON.parse(kuis!.content_body);
      expect(Array.isArray(isi.questions)).toBe(true);
      expect(isi.questions.length).toBeGreaterThanOrEqual(3);
      // Kunci jawaban harus sepanjang jumlah soal (agar kuis dapat dinilai).
      expect((kuis!.quiz_key ?? []).length).toBe(isi.questions.length);
      // Setiap soal punya 4 opsi dan pertanyaannya terbaca utuh.
      for (const q of isi.questions) {
        expect(q.options.length).toBe(4);
        expect(q.text.length).toBeLessThan(120);
      }
    }
  });

  it('kuis default disusun dari isi materinya (jawaban ada di materi)', async () => {
    const c = await client.query<{ id: number }>("SELECT id FROM moodle_courses WHERE course_code = 'ONB-101'");
    const mods = await client.query<{ content_type: string; content_body: string }>(
      'SELECT content_type, content_body FROM course_modules WHERE course_id = $1',
      [c.rows[0].id]
    );
    const materi = mods.rows.filter((m) => m.content_type !== 'QUIZ').map((m) => m.content_body).join(' ');
    const kuis = JSON.parse(mods.rows.find((m) => m.content_type === 'QUIZ')!.content_body);

    // Tiga soal pertama berasal dari materi: jawaban benarnya ada di teks materi.
    for (const q of kuis.questions.slice(0, 3)) {
      const benar = q.options[0].replace(/\.$/, '');
      expect(materi.includes(benar), `jawaban "${benar.slice(0, 40)}" ada di materi`).toBe(true);
    }
  });

  it('materi kursus onboarding posisi tidak dipakai bersama posisi lain', async () => {
    const swe = await listPositionCourses(db, posSWE);
    const ceo = await listPositionCourses(db, posCEO);
    // Kode kursus onboarding per posisi harus berbeda.
    const kodeSWE = swe.filter((c) => /^ONB-/.test(c.courseCode) && c.courseCode !== 'ONB-101').map((c) => c.courseCode);
    const kodeCEO = ceo.filter((c) => /^ONB-/.test(c.courseCode) && c.courseCode !== 'ONB-101').map((c) => c.courseCode);
    for (const k of kodeSWE) expect(kodeCEO).not.toContain(k);
  });
});
