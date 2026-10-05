import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { NextRequest } from 'next/server';
import { POST as upload } from '@/app/api/v1/careers/upload/route';
import { POST as apply } from '@/app/api/v1/careers/apply/route';

const CV_TXT = `Rina Kartika
rina.kartika@example.com | 0813-2222-3333

RINGKASAN
HR specialist berpengalaman 4 tahun di bidang rekrutmen dan HRIS, kuat dalam
komunikasi dan manajemen data karyawan untuk perusahaan teknologi.

PENGALAMAN KERJA
HR Specialist | PT Sumber Daya Digital | Feb 2021 - Sekarang
Mengelola rekrutmen end-to-end dan administrasi HRIS.

PENDIDIKAN
S1 Manajemen, Universitas Gadjah Mada, 2015 - 2019, IPK 3.50

KEAHLIAN
HRIS, Recruitment, Excel, Komunikasi, Payroll
`;

const CV_TECH = `Budi Santoso
budi.santoso@example.com | 0812-3456-7890

RINGKASAN
Software engineer 5 tahun membangun aplikasi web dengan TypeScript, React, Next.js
dan PostgreSQL untuk platform SaaS berskala besar.

PENGALAMAN KERJA
Senior Software Engineer | PT Teknologi Nusantara | Jan 2020 - Sekarang
Mengembangkan platform dengan Next.js dan PostgreSQL.

PENDIDIKAN
S1 Teknik Informatika, Universitas Indonesia, 2014 - 2018, IPK 3.65

KEAHLIAN
TypeScript, Next.js, PostgreSQL, React, Node.js
`;

function multipartReq(fileName: string, content: string, type = 'text/plain'): NextRequest {
  const fd = new FormData();
  fd.append('file', new File([content], fileName, { type }));
  return new NextRequest('http://localhost:3000/api/v1/careers/upload', { method: 'POST', body: fd });
}

function applyReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/v1/careers/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('WS-4 endpoint upload & apply + ATS', () => {
  let client: PGlite;
  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    await client.exec(`UPDATE job_postings SET is_public = TRUE, status = 'OPEN' WHERE id IN (SELECT id FROM job_postings LIMIT 3);`);
  });
  afterAll(async () => { await client.close(); });

  it('upload mengekstrak teks & mendeteksi skill dari file TXT', async () => {
    const res = await upload(multipartReq('cv-rina.txt', CV_TXT));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.extracted).toBe(true);
    expect(json.data.rawText).toContain('Rina');
    expect(json.data.detectedSkills).toEqual(expect.arrayContaining(['HRIS', 'Recruitment', 'Excel']));
    expect(json.data.parsed.contact.email).toBe('rina.kartika@example.com');
  });

  it('upload mengekstrak gender, NIK, dan alamat dari CV', async () => {
    const cv = `Dimas Pratama
dimas.pratama@example.com | 0812-1111-2222
Jenis Kelamin: Laki-laki
NIK: 3201234567890003
Alamat: Jl. Cikini Raya No. 5, RT 02/RW 03
Kota: Jakarta Pusat
Provinsi: DKI Jakarta
Kode Pos: 10330

RINGKASAN
Data engineer berpengalaman 6 tahun membangun pipeline data.

PENDIDIKAN
S1 Teknik Informatika, Universitas Indonesia, 2012 - 2016, IPK 3.55
`;
    const res = await upload(multipartReq('cv-dimas.txt', cv));
    expect(res.status).toBe(200);
    const json = await res.json();
    const p = json.data.parsed;
    expect(p.gender).toBe('LAKI_LAKI');
    expect(p.nik).toBe('3201234567890003');
    expect(p.address).toContain('Cikini');
    expect(p.city).toBe('Jakarta Pusat');
    expect(p.province).toBe('DKI Jakarta');
    expect(p.postalCode).toBe('10330');
  });

  it('upload menolak ekstensi tidak didukung', async () => {
    const res = await upload(multipartReq('cv.exe', 'binary', 'application/octet-stream'));
    expect(res.status).toBe(415);
  });

  it('upload tanpa file → 400', async () => {
    const fd = new FormData();
    const req = new NextRequest('http://localhost:3000/api/v1/careers/upload', { method: 'POST', body: fd });
    const res = await upload(req);
    expect(res.status).toBe(400);
  });

  it('apply dengan resumeText mengembalikan skor ATS + matched/missing', async () => {
    // Ambil lowongan publik dari seed.
    const q = await client.query<{ id: string }>(
      `SELECT id FROM job_postings WHERE is_public = TRUE AND status = 'OPEN' LIMIT 1`,
    );
    const postingId = q.rows[0].id;
    const res = await apply(applyReq({
      fullName: 'Rina Kartika', email: 'rina.kartika@example.com', phone: '08132222333',
      jobPostingId: postingId, resumeText: CV_TECH, resumeFileName: 'cv-budi.txt',
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.applicationNo).toMatch(/^APP-/);
    expect(json.data.ats).toBeTruthy();
    expect(json.data.ats.score).toBeGreaterThan(0);
    expect(Array.isArray(json.data.ats.matched)).toBe(true);
  });

  it('apply tanpa resume tetap sukses (ATS null, tidak crash)', async () => {
    const q = await client.query<{ id: string }>(
      `SELECT id FROM job_postings WHERE is_public = TRUE AND status = 'OPEN' LIMIT 1`,
    );
    const postingId = q.rows[0].id;
    const res = await apply(applyReq({
      fullName: 'Tanpa CV', email: 'tanpa.cv@example.com', jobPostingId: postingId,
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.ats).toBeNull();
  });

  it('apply honeypot terisi ditolak', async () => {
    const res = await apply(applyReq({
      fullName: 'Bot', email: 'bot@example.com', jobPostingId: '87000000-0000-4000-8000-000000000001',
      website: 'http://spam.example.com',
    }));
    expect(res.status).toBe(400);
  });
});
