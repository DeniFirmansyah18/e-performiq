import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { listPositionCourses, generateOnboardingProgram, getOnboardingStatus } from '@/lib/services/onboardingService';

let client: PGlite;
let db: Db;

/** Id posisi Senior Software Engineer pada seed. */
const POS_SWE = 'a0000000-0000-4000-8000-000000000204';

beforeAll(async () => {
  ({ client } = await createTestDb());
  await runSeed(client);
  db = drizzle(client) as unknown as Db;
}, 60000);

afterAll(async () => {
  await client.close();
});

describe('kursus onboarding posisi tampil di LMS HR (kursus terpetakan)', () => {
  it('setelah seed, kursus onboarding SWE sudah terpetakan sehingga muncul di LMS HR', async () => {
    const courses = await listPositionCourses(db, POS_SWE);
    const onb = courses.filter((c) => /^Onboarding /i.test(c.title) && !/Onboarding 101/i.test(c.title));
    expect(
      onb.length,
      `kursus onboarding posisi belum ada di kursus terpetakan: ${courses.map((c) => c.title).join(' | ')}`
    ).toBeGreaterThan(0);
    expect(onb[0].title).toMatch(/Senior Software Engineer/i);
  });

  it('kursus onboarding SWE punya materi yang dapat diedit', async () => {
    const courses = await listPositionCourses(db, POS_SWE);
    const onb = courses.find((c) => /^Onboarding .*Senior Software Engineer/i.test(c.title));
    expect(onb, 'kursus onboarding SWE ada').toBeTruthy();

    const mods = await client.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM course_modules WHERE course_id = $1',
      [onb!.courseId]
    );
    expect(mods.rows[0].n, 'kursus onboarding punya modul/materi').toBeGreaterThan(0);
  });

  it('tidak ada kursus yang dipetakan ke posisi lain ikut masuk onboarding SWE', async () => {
    const emp = await client.query<{ id: string }>(
      `SELECT id::text AS id FROM employees WHERE position_id = $1::uuid AND status IN ('PERMANENT','PROBATION') LIMIT 1`,
      [POS_SWE]
    );
    await generateOnboardingProgram(db, { employeeId: emp.rows[0].id });
    const status = await getOnboardingStatus(db, emp.rows[0].id);
    const judul = status.items.map((i) => String(i.title ?? ''));

    // Kursus onboarding yang menyebut posisi LAIN tidak boleh muncul.
    const bocor = judul.filter(
      (t) => /^Onboarding (?!101)/i.test(t) && !/Senior Software Engineer/i.test(t)
    );
    expect(bocor, `kursus posisi lain ikut muncul: ${bocor.join(' | ')}`).toEqual([]);
  });

  it('kursus teknis yang dipetakan seed tetap relevan untuk posisi SWE', async () => {
    const courses = await listPositionCourses(db, POS_SWE);
    const kode = courses.map((c) => c.courseCode);
    // Kursus teknis ini memang dipetakan seed ke SWE karena sesuai skill posisi.
    expect(kode).toContain('PG-ADV');
    expect(kode).toContain('CLOUD-ARCH');
    // Kursus milik posisi lain tidak boleh ikut.
    expect(kode).not.toContain('LEAD-ESS');
  });
});
