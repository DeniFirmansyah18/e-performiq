import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import {
  ubahKursus,
  ubahModul,
  daftarModulKursus,
  tambahModulMateri,
} from '@/lib/services/learningLmsService';

let client: PGlite;
let db: Db;
let courseId = 0;

beforeAll(async () => {
  ({ client } = await createTestDb());
  await runSeed(client);
  db = drizzle(client) as unknown as Db;
  const r = await client.query<{ id: number }>('SELECT id FROM moodle_courses ORDER BY id LIMIT 1');
  courseId = r.rows[0].id;
}, 60000);

afterAll(async () => {
  await client.close();
});

describe('HR dapat menyesuaikan kursus terpetakan', () => {
  it('mengubah judul, kategori, dan jam kursus', async () => {
    await ubahKursus(db, courseId, { title: 'Judul Baru Perusahaan', category: 'Internal', hours: 6 });
    const r = await client.query<{ title: string; category: string; default_hours: number }>(
      'SELECT title, category, default_hours FROM moodle_courses WHERE id = $1',
      [courseId]
    );
    expect(r.rows[0].title).toBe('Judul Baru Perusahaan');
    expect(r.rows[0].category).toBe('Internal');
    expect(Number(r.rows[0].default_hours)).toBe(6);
  });

  it('mengubah deskripsi kursus', async () => {
    await ubahKursus(db, courseId, { description: 'Disesuaikan dengan SOP perusahaan.' });
    const r = await client.query<{ description: string }>('SELECT description FROM moodle_courses WHERE id = $1', [courseId]);
    expect(r.rows[0].description).toContain('SOP perusahaan');
  });

  it('HR bisa menambah modul materi sendiri', async () => {
    const sebelum = (await daftarModulKursus(db, courseId)).length;
    await tambahModulMateri(db, courseId, {
      title: 'Materi Internal Perusahaan',
      contentType: 'VIDEO',
      contentUrl: 'https://www.open.edu/openlearn/money-business/x',
      contentBody: 'Materi wajib internal.',
    });
    const sesudah = await daftarModulKursus(db, courseId);
    expect(sesudah.length).toBe(sebelum + 1);
    expect(sesudah.some((m) => m.title === 'Materi Internal Perusahaan')).toBe(true);
  });

  it('mengubah judul & tautan sebuah modul', async () => {
    const modul = (await daftarModulKursus(db, courseId))[0];
    await ubahModul(db, modul.id, {
      title: 'Modul Diedit HR',
      contentUrl: 'https://ocw.mit.edu/courses/x',
    });
    const sesudah = await daftarModulKursus(db, courseId);
    const m = sesudah.find((x) => x.id === modul.id)!;
    expect(m.title).toBe('Modul Diedit HR');
    expect(m.contentUrl).toBe('https://ocw.mit.edu/courses/x');
  });

  it('menolak tautan modul dari domain tidak tepercaya', async () => {
    const modul = (await daftarModulKursus(db, courseId))[0];
    await expect(
      ubahModul(db, modul.id, { contentUrl: 'https://situs-asing.example.com/x' })
    ).rejects.toThrow(/tepercaya|domain/i);
  });

  it('menolak tautan berbayar', async () => {
    const modul = (await daftarModulKursus(db, courseId))[0];
    await expect(
      ubahModul(db, modul.id, { contentUrl: 'https://www.udemy.com/course/x' })
    ).rejects.toThrow(/berbayar|tepercaya/i);
  });
});
