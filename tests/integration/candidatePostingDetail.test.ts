import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { listCandidatePostings } from '@/lib/services/candidateService';

let client: PGlite;
let db: Db;

beforeAll(async () => {
  ({ client } = await createTestDb());
  await runSeed(client);
  db = drizzle(client) as unknown as Db;

  // Pakai lowongan yang sudah publik (bila tidak ada, jadikan publik), lalu isi
  // rinciannya agar pemeriksaan di bawah menguji nilai yang kita tetapkan.
  await client.query(
    `UPDATE job_postings
        SET is_public = TRUE,
            salary_min = 15000000, salary_max = 25000000,
            min_education = 'S1 Teknik Informatika',
            min_experience_years = 3,
            work_location = 'Hybrid',
            employment_type = 'PERMANENT'
      WHERE id = (SELECT id FROM job_postings ORDER BY posted_at LIMIT 1)`
  );
}, 60000);

afterAll(async () => {
  await client.close();
});

describe('lowongan di portal kandidat memuat rincian lengkap', () => {
  it('mengirim rentang gaji, pendidikan, pengalaman, dan lokasi', async () => {
    const postings = await listCandidatePostings(db, {});
    expect(postings.length).toBeGreaterThan(0);

    const p = postings.find((x) => x.minEducation === 'S1 Teknik Informatika');
    expect(p, 'lowongan yang rinciannya baru diisi ikut terkirim').toBeTruthy();
    // Inilah keluhan pengguna: gaji tidak muncul di portal kandidat.
    expect(p!.salaryMin).toBe(15000000);
    expect(p!.salaryMax).toBe(25000000);
    expect(p!.minExperienceYears).toBe(3);
    expect(p!.workLocation).toBe('Hybrid');
    expect(p!.employmentType).toBe('PERMANENT');
  });

  it('tetap mengirim judul, deskripsi, keahlian, dan kuota', async () => {
    const postings = await listCandidatePostings(db, {});
    const p = postings[0];
    expect(p.postingTitle).toBeTruthy();
    expect(p.description).toBeTruthy();
    expect(typeof p.quota).toBe('number');
  });

  it('lowongan tanpa rincian tidak mengarang nilai', async () => {
    await client.query(
      `INSERT INTO job_postings (manpower_plan_id, position_id, department_id, posting_title, description, is_public)
       SELECT mp.id, mp.position_id, mp.department_id, 'Lowongan Tanpa Rincian', 'Deskripsi uji minimal sepuluh karakter', TRUE
         FROM manpower_plans mp LIMIT 1
       ON CONFLICT DO NOTHING`
    );
    const postings = await listCandidatePostings(db, { search: 'Tanpa Rincian' });
    const p = postings[0];
    expect(p).toBeTruthy();
    expect(p.salaryMin).toBeNull();
    expect(p.salaryMax).toBeNull();
    expect(p.minEducation).toBeNull();
    expect(p.workLocation).toBeNull();
  });
});
