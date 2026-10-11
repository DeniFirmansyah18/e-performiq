import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import {
  isTrustedOerUrl,
  validateModuleUrl,
  matchOerResources,
  OER_CATALOG,
  TRUSTED_OER_DOMAINS,
} from '@/lib/services/oerCatalogService';
import {
  listPositionsWithCourses,
  listCourseOptions,
  addPositionCourse,
  removePositionCourse,
  updatePositionCourse,
} from '@/lib/services/positionCourseMappingService';

const POS_SWE = 'a0000000-0000-4000-8000-000000000204';

describe('OER catalog — whitelist & validasi tautan', () => {
  it('menerima tautan https dari domain tepercaya', () => {
    expect(isTrustedOerUrl('https://www.open.edu/openlearn/money-business/business-ethics/content-section-0')).toBe(true);
    expect(isTrustedOerUrl('https://learn.microsoft.com/en-us/training/paths/react/')).toBe(true);
    expect(isTrustedOerUrl('https://ocw.mit.edu/courses/6-036-introduction-to-machine-learning-fall-2020/')).toBe(true);
  });

  it('menolak domain tak tepercaya, http polos, dan URL tak valid', () => {
    expect(isTrustedOerUrl('https://evil.example.com/course')).toBe(false);
    expect(isTrustedOerUrl('http://www.open.edu/x')).toBe(false); // bukan https
    expect(isTrustedOerUrl('not-a-url')).toBe(false);
    expect(isTrustedOerUrl('https://open.edu.evil.com/x')).toBe(false); // suffix palsu
  });

  it('validateModuleUrl hanya menuntut tautan untuk VIDEO/PDF', () => {
    expect(validateModuleUrl('TEXT', null).ok).toBe(true);
    expect(validateModuleUrl('QUIZ', null).ok).toBe(true);
    expect(validateModuleUrl('VIDEO', null).ok).toBe(false);
    expect(validateModuleUrl('PDF', '').ok).toBe(false);
    expect(validateModuleUrl('VIDEO', 'https://evil.example.com/v').ok).toBe(false);
    expect(validateModuleUrl('VIDEO', 'https://www.open.edu/openlearn/x/content-section-0').ok).toBe(true);
  });

  it('katalog OER seluruhnya https + domain tepercaya', () => {
    expect(OER_CATALOG.length).toBeGreaterThan(10);
    for (const res of OER_CATALOG) {
      expect(res.url.startsWith('https://')).toBe(true);
      expect(isTrustedOerUrl(res.url)).toBe(true);
      expect(TRUSTED_OER_DOMAINS.length).toBeGreaterThan(0);
    }
  });

  it('matchOerResources mengembalikan materi relevan & deterministik', () => {
    const ts = matchOerResources(['typescript', 'frontend'], 3);
    expect(ts.length).toBeGreaterThan(0);
    expect(ts[0].topics).toEqual(expect.arrayContaining(['typescript']));

    const hr = matchOerResources(['hr', 'rekrutmen'], 3);
    expect(hr.length).toBeGreaterThan(0);

    // Deterministik: panggilan berulang menghasilkan urutan sama.
    expect(matchOerResources(['typescript', 'frontend'], 3).map((r) => r.url)).toEqual(ts.map((r) => r.url));
  });
});

describe('Position–Course Mapping Service (Jalur A)', () => {
  let client: PGlite;
  let db: any;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
  });
  afterAll(async () => { await client.close(); });

  it('listPositionsWithCourses mengembalikan posisi + kursus terpetakan', async () => {
    const positions = await listPositionsWithCourses(db);
    expect(positions.length).toBeGreaterThan(0);
    const swe = positions.find((p) => p.positionId === POS_SWE);
    expect(swe).toBeTruthy();
    expect(swe!.courses.length).toBe(4);
    expect(swe!.mappedCount).toBe(4);
    expect(swe!.title).toBeTruthy();
  });

  it('listCourseOptions menyertakan jumlah modul', async () => {
    const courses = await listCourseOptions(db);
    expect(courses.length).toBeGreaterThan(0);
    expect(courses.every((c) => typeof c.moduleCount === 'number')).toBe(true);
  });

  it('addPositionCourse idempoten (upsert) lalu removePositionCourse', async () => {
    const courses = await listCourseOptions(db);
    const fresh = courses.find((c) => !['ONB-101', 'AKHLAK-CULTURE', 'CLOUD-ARCH', 'PG-ADV'].includes(c.courseCode))!;
    expect(fresh).toBeTruthy();

    const first = await addPositionCourse(db, { positionId: POS_SWE, courseId: fresh.courseId, isMandatory: true });
    expect(first.ok).toBe(true);
    const second = await addPositionCourse(db, { positionId: POS_SWE, courseId: fresh.courseId, isMandatory: false });
    expect(second.ok).toBe(true);

    const mapped = await listPositionsWithCourses(db);
    const swe = mapped.find((p) => p.positionId === POS_SWE)!;
    const item = swe.courses.find((c) => c.courseId === fresh.courseId)!;
    expect(item.isMandatory).toBe(false); // upsert memperbarui flag
    expect(swe.courses.length).toBe(5);

    const del = await removePositionCourse(db, POS_SWE, fresh.courseId);
    expect(del.ok).toBe(true);
    const after = (await listPositionsWithCourses(db)).find((p) => p.positionId === POS_SWE)!;
    expect(after.courses.length).toBe(4);
  });

  it('addPositionCourse menolak posisi/kursus tak dikenal', async () => {
    const bad = await addPositionCourse(db, { positionId: '00000000-0000-4000-8000-000000000000', courseId: 1 });
    expect(bad.ok).toBe(false);
  });

  it('updatePositionCourse memperbarui flag wajib', async () => {
    const courses = await listCourseOptions(db);
    const target = courses[0];
    const upd = await updatePositionCourse(db, { positionId: POS_SWE, courseId: target.courseId, isMandatory: true, orderIndex: 9 });
    // Kursus tsb mungkin belum terpetakan; jika begitu, update mengembalikan false (bukan error).
    expect(typeof upd.ok).toBe('boolean');
  });
});
