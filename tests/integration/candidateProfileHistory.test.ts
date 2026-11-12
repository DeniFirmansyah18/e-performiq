import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { getApplicationDetail } from '@/lib/services/candidateService';

let client: PGlite;
let db: Db;
let applicationId = '';

beforeAll(async () => {
  ({ client } = await createTestDb());
  await runSeed(client);
  db = drizzle(client) as unknown as Db;

  // Kandidat seed yang punya pengalaman dengan start_date/end_date terisi.
  const a = await client.query<{ id: string }>(
    `SELECT ja.id::text AS id FROM job_applications ja
      WHERE EXISTS (SELECT 1 FROM candidate_experiences x WHERE x.candidate_id = ja.candidate_id)
      LIMIT 1`
  );
  applicationId = a.rows[0]?.id ?? '';
}, 60000);

afterAll(async () => {
  await client.close();
});

describe('profil kandidat untuk HR — riwayat pekerjaan', () => {
  it('mengisi tanggal mulai/selesai dari kolom start_date/end_date', async () => {
    const p: any = await getApplicationDetail(db, applicationId);
    expect(p).toBeTruthy();
    expect(p.experiences?.length).toBeGreaterThan(0);

    const x = p.experiences[0];
    // Tanggal harus terbaca, bukan null, agar UI tidak menampilkan garis kosong.
    expect(x.startYear, 'startYear harus terisi dari start_date').not.toBeNull();
    expect(x.startMonth, 'startMonth harus terisi dari start_date').not.toBeNull();
  });

  it('tetap memakai start_year/start_month bila kolom tanggal kosong', async () => {
    const c = await client.query<{ candidate_id: string }>(
      'SELECT candidate_id::text AS candidate_id FROM candidate_experiences LIMIT 1'
    );
    const cid = c.rows[0].candidate_id;

    // Baris dengan hanya kolom tahun/bulan (jalur input kandidat terbaru).
    await client.query(
      `INSERT INTO candidate_experiences (candidate_id, company, role_title, experience_type, start_month, start_year)
       VALUES ($1::uuid, 'PT Uji Tahun', 'Analis', 'KERJA', 3, 2019)`,
      [cid]
    );

    const p: any = await getApplicationDetail(db, applicationId);
    const baru = p.experiences.find((x: any) => x.company === 'PT Uji Tahun');
    expect(baru).toBeTruthy();
    expect(baru.startYear).toBe(2019);
    expect(baru.startMonth).toBe(3);
  });

  it('meneruskan jenis pengalaman (KERJA) agar tampil di UI', async () => {
    const p: any = await getApplicationDetail(db, applicationId);
    const ada = p.experiences.some((x: any) => x.experienceType === 'KERJA');
    expect(ada).toBe(true);
  });
});
