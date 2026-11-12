import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { submitApplication, getApplicationDetail } from '@/lib/services/candidateService';

let client: PGlite;
let db: Db;
let jobPostingId = '';
let seq = 0;

async function lamar(input: Record<string, unknown>) {
  seq++;
  const hasil: any = await submitApplication(db, {
    fullName: `Uji ${seq}`,
    email: `uji.form.${seq}.${Date.now()}@example.com`,
    jobPostingId,
    ...input,
  } as any);
  const detail: any = await getApplicationDetail(db, hasil.applicationId);
  return { hasil, detail };
}

beforeAll(async () => {
  ({ client } = await createTestDb());
  await runSeed(client);
  db = drizzle(client) as unknown as typeof db;
  const jp = await client.query<{ id: string }>('SELECT id FROM job_postings WHERE is_public = TRUE LIMIT 1');
  jobPostingId = jp.rows[0].id;
}, 60000);

afterAll(async () => {
  await client.close();
});

describe('form "ajukan lamaran" — riwayat pendidikan', () => {
  it('menyimpan semua field pendidikan', async () => {
    const { detail } = await lamar({
      educations: [{
        level: 'S1', degree: 'S1', institution: 'Pesantren Tinggi Darul Ulum University',
        major: 'Teknik Informatika', startYear: 2022, endYear: 2026,
        graduationStatus: 'LULUS', gpa: 3.5,
      }],
    });
    const e = detail.educations[0];
    expect(e.level).toBe('S1');
    expect(e.institution).toBe('Pesantren Tinggi Darul Ulum University');
    expect(e.major).toBe('Teknik Informatika');
    expect(e.startYear).toBe(2022);
    expect(e.endYear).toBe(2026);
    expect(e.graduationStatus).toBe('LULUS');
    expect(Number(e.gpa)).toBeCloseTo(3.5, 2);
  });

  it('IPK 0 tetap tersimpan (bukan dianggap kosong)', async () => {
    // Kiriman form memakai `gpa: x.gpa ? Number(x.gpa) : null`, sehingga "0"
    // berubah menjadi null. IPK 0.00 sah (mis. skala 0–4 nilai terendah).
    const { detail } = await lamar({
      educations: [{ level: 'S1', institution: 'Kampus IPK Nol', gpa: 0, startYear: 2020, endYear: 2024 }],
    });
    expect(detail.educations[0].gpa, 'IPK 0 harus tersimpan, bukan null').toBe(0);
  });

  it('pendidikan dengan jurusan saja (tanpa institusi) tetap tersimpan', async () => {
    // Filter form: `x.institution || x.major || x.level` → lolos.
    // Filter service: `!e.institution && !e.major && !e.level` → juga lolos.
    const { detail } = await lamar({
      educations: [{ major: 'Akuntansi' }],
    });
    expect(detail.educations.length, 'entri dengan jurusan saja tidak boleh hilang').toBe(1);
    expect(detail.educations[0].major).toBe('Akuntansi');
  });

  it('banyak entri pendidikan tersimpan semuanya', async () => {
    const { detail } = await lamar({
      educations: [
        { level: 'SMA', institution: 'SMA Negeri 1', startYear: 2016, endYear: 2019 },
        { level: 'S1', institution: 'Universitas Contoh', startYear: 2019, endYear: 2023 },
      ],
    });
    expect(detail.educations.length).toBe(2);
  });
});

describe('form "ajukan lamaran" — riwayat pekerjaan', () => {
  it('menyimpan semua field pekerjaan', async () => {
    const { detail } = await lamar({
      experiences: [{
        experienceType: 'KERJA', roleTitle: 'Staff IT', company: 'PT Contoh',
        location: 'Jakarta', startMonth: 7, startYear: 2023,
        endMonth: 8, endYear: 2024, isCurrent: false,
      }],
    });
    const x = detail.experiences[0];
    expect(x.roleTitle).toBe('Staff IT');
    expect(x.company).toBe('PT Contoh');
    expect(x.location).toBe('Jakarta');
    expect(x.startMonth).toBe(7);
    expect(x.startYear).toBe(2023);
    expect(x.endMonth).toBe(8);
    expect(x.endYear).toBe(2024);
    expect(x.experienceType).toBe('KERJA');
  });

  it('"masih bekerja di sini" menyimpan isCurrent tanpa tanggal akhir', async () => {
    const { detail } = await lamar({
      experiences: [{
        experienceType: 'KERJA', roleTitle: 'Engineer', company: 'PT Sekarang',
        startMonth: 1, startYear: 2024, endMonth: null, endYear: null, isCurrent: true,
      }],
    });
    const x = detail.experiences[0];
    expect(x.isCurrent).toBe(true);
    expect(x.endMonth).toBeNull();
    expect(x.endYear).toBeNull();
  });

  it('pengalaman MAGANG tersimpan dengan jenisnya', async () => {
    const { detail } = await lamar({
      experiences: [{ experienceType: 'MAGANG', roleTitle: 'Intern', company: 'PT Magang' }],
    });
    expect(detail.experiences[0].experienceType).toBe('MAGANG');
  });

  it('"tidak punya pengalaman" mengosongkan riwayat', async () => {
    const { detail } = await lamar({
      noExperience: true,
      experiences: [{ experienceType: 'KERJA', roleTitle: 'Tidak boleh masuk', company: 'X' }],
    });
    expect(detail.experiences.length).toBe(0);
  });

  it('entri pekerjaan kosong (tanpa jabatan & perusahaan) tidak disimpan', async () => {
    const { detail } = await lamar({
      experiences: [{ experienceType: 'KERJA', startYear: 2020 }],
    });
    expect(detail.experiences.length).toBe(0);
  });
});
