import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';

let client: PGlite;
let db: Db;

beforeAll(async () => {
  ({ client } = await createTestDb());
  await runSeed(client);
  db = drizzle(client) as unknown as Db;
}, 60000);

afterAll(async () => {
  await client.close();
});

/** Kode template seperti yang dipakai service (8 huruf pertama id posisi). */
function kodeLama(positionId: string) {
  return `TECH-${positionId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

describe('template tes teknis per posisi', () => {
  it('kode berbasis 8 huruf pertama UUID memang rawan bentrok', async () => {
    const p = await client.query<{ id: string }>('SELECT id::text AS id FROM job_positions');
    const kode = new Set(p.rows.map((x) => kodeLama(x.id)));
    // Seed memakai awalan UUID yang sama, jadi seluruh posisi berbagi kode.
    expect(p.rows.length).toBeGreaterThan(10);
    expect(kode.size, 'jumlah kode unik').toBeLessThan(p.rows.length);
  });

  it('generate soal tidak melempar galat untuk banyak lowongan berbeda', async () => {
    // positionId pada fungsi ini = id LOWONGAN (job_postings), sesuai kontraknya.
    const posisi = await client.query<{ id: string; title: string }>(`
      SELECT jp.id::text AS id, p.position_title AS title
        FROM job_postings jp JOIN job_positions p ON p.id = jp.position_id
       ORDER BY p.position_title LIMIT 5
    `);

    const { generateTechnicalQuestions } = await import('@/lib/services/technicalTestGenerator');

    const gagal: string[] = [];
    for (const p of posisi.rows) {
      try {
        await generateTechnicalQuestions(db, { positionId: p.id, count: 3 } as any);
      } catch (e: any) {
        gagal.push(`${p.title}: ${e?.message ?? e}`);
      }
    }
    expect(posisi.rows.length).toBeGreaterThanOrEqual(5);
    expect(gagal, `lowongan yang gagal: ${gagal.join(' | ')}`).toEqual([]);
  });

  it('penyiapan template tidak bentrok antar posisi (inti bug)', async () => {
    // Bug: kode template memakai 8 huruf pertama UUID. Karena id posisi seed
    // berawalan sama, posisi ke-2 dst gagal membuat template baru.
    const { siapkanTemplateTeknisUntukUji } = await import('@/lib/services/technicalTestGenerator');

    const posisi = await client.query<{ id: string; title: string }>(
      'SELECT id::text AS id, position_title AS title FROM job_positions ORDER BY position_title LIMIT 5'
    );

    const idTemplate: string[] = [];
    const gagal: string[] = [];
    for (const p of posisi.rows) {
      try {
        const t = await siapkanTemplateTeknisUntukUji(db, p.id, p.title);
        idTemplate.push(t.id);
      } catch (e: any) {
        gagal.push(`${p.title}: ${e?.message ?? e}`);
      }
    }

    expect(gagal, `posisi yang gagal menyiapkan template: ${gagal.join(' | ')}`).toEqual([]);
    expect(idTemplate.length, 'template terbentuk').toBe(posisi.rows.length);
    // Tiap posisi mendapat template berbedanya sendiri.
    expect(new Set(idTemplate).size, 'template tidak boleh dipakai bersama').toBe(idTemplate.length);
  });

  it('setiap posisi punya template TECHNICAL sendiri (bukan berbagi)', async () => {
    const hasil = await client.query<{ pid: string; n: number }>(`
      SELECT position_id::text AS pid, count(*)::int AS n
        FROM assessment_templates
       WHERE type = 'TECHNICAL'::assessment_type_enum AND position_id IS NOT NULL
       GROUP BY position_id
    `);
    // Minimal 5 posisi berbeda harus punya template masing-masing.
    expect(hasil.rows.length, 'jumlah posisi bertemplate').toBeGreaterThanOrEqual(5);
    expect(hasil.rows.every((r) => r.n === 1), 'satu template per posisi').toBe(true);
  });

  it('kode template unik di seluruh tabel', async () => {
    const dup = await client.query<{ code: string; n: number }>(`
      SELECT code, count(*)::int AS n FROM assessment_templates GROUP BY code HAVING count(*) > 1
    `);
    expect(dup.rows, 'kode duplikat').toEqual([]);
  });
});
