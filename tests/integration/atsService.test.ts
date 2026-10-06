import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import {
  matchSkills,
  computeAtsScore,
  canonicalSkill,
  runAts,
} from '@/lib/services/atsService';
import { parseResumeHeuristic, extractSkills, extractTextFromDocx, extractTextFromPdf } from '@/lib/services/resumeParser';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SAMPLE_CV = `Budi Santoso
budi.santoso@example.com | 0812-3456-7890
linkedin.com/in/budisantoso

RINGKASAN
Software engineer dengan pengalaman 5 tahun membangun aplikasi web berskala besar
menggunakan TypeScript, React, dan Node.js. Fokus pada arsitektur bersih dan kinerja.

PENGALAMAN KERJA
Senior Software Engineer | PT Teknologi Nusantara | Jan 2020 - Sekarang
Memimpin tim 4 engineer mengembangkan platform SaaS dengan Next.js dan PostgreSQL.
Software Engineer | CV Digital Karya | 2018-01 - 2019-12
Membangun REST API menggunakan Django dan Redis.

PENDIDIKAN
S1 Teknik Informatika, Universitas Indonesia, 2014 - 2018, IPK 3.65

KEAHLIAN
TypeScript, React, Node.js, PostgreSQL, Docker, Git, Komunikasi, Kepemimpinan
`;

/** Bangun berkas DOCX minimal (ZIP) dengan entri yang diberikan (stored/no compress). */
function buildDocx(entries: Array<{ name: string; content: string }>): Buffer {
  const chunk = (buf: Buffer) => {
    let crc = 0xffffffff;
    for (const b of buf) {
      crc ^= b;
      for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const data = Buffer.from(e.content, 'utf8');
    const crc = chunk(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const localFull = Buffer.concat([local, nameBuf, data]);
    locals.push(localFull);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, nameBuf]));
    offset += localFull.length;
  }
  const centralDir = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDir, eocd]);
}

describe('WS-4 ATS service', () => {
  describe('matchSkills', () => {
    it('mencocokkan skill kanonik, alias, dan melaporkan gap', () => {
      const res = matchSkills(
        ['TypeScript', 'React', 'Postgres', 'Komunikasi'],
        ['TypeScript', 'React', 'PostgreSQL', 'Docker'],
      );
      expect(res.matched).toEqual(expect.arrayContaining(['TypeScript', 'React', 'PostgreSQL']));
      expect(res.missing).toEqual(['Docker']);
      expect(res.matchRatio).toBeCloseTo(0.75, 5);
    });

    it('tidak over-match string pendek (Go vs Google)', () => {
      const res = matchSkills(['Google Cloud'], ['Go']);
      expect(res.missing).toContain('Go');
    });

    it('canonicalSkill menormalkan alias', () => {
      expect(canonicalSkill('Postgres')).toBe('PostgreSQL');
      expect(canonicalSkill('JS')).toBe('JavaScript');
    });

    it('requirement kosong menghasilkan ratio 0 (bukan NaN)', () => {
      const res = matchSkills(['React'], []);
      expect(res.required).toEqual([]);
      expect(res.matchRatio).toBe(0);
    });

    it('cocok walau lowongan menulis "Next.Js" dan CV menulis "Next.js"/"NextJs"', () => {
      const required = ['Next.Js', 'TypeScript'];
      for (const variant of ['Next.Js, TypeScript', 'Next.js, TypeScript', 'NextJs, TypeScript', 'NextJS TypeScript']) {
        const res = matchSkills(extractSkills(variant), required);
        expect(res.missing, `varian: ${variant}`).toEqual([]);
        expect(res.matchRatio, `varian: ${variant}`).toBe(1);
      }
    });
  });

  describe('parseResumeHeuristic', () => {
    it('mengekstrak kontak, skill, pendidikan, dan pengalaman', () => {
      const p = parseResumeHeuristic(SAMPLE_CV);
      expect(p.contact.email).toBe('budi.santoso@example.com');
      expect(p.contact.phone).toContain('0812');
      expect(p.fullName).toContain('Budi');
      expect(p.skills).toEqual(expect.arrayContaining(['TypeScript', 'React', 'Node.js', 'PostgreSQL']));
      expect(p.educations.length).toBeGreaterThanOrEqual(1);
      expect(p.educations[0].degree).toBe('S1');
      expect(p.educations[0].gpa).toBeCloseTo(3.65, 2);
      expect(p.experiences.length).toBeGreaterThanOrEqual(1);
      expect(p.totalExperienceYears).toBeGreaterThan(3);
    });

    it('teks kosong / tak terbaca tidak melempar error', () => {
      const p = parseResumeHeuristic('');
      expect(p.skills).toEqual([]);
      expect(p.experiences).toEqual([]);
      expect(p.parser).toBe('HEURISTIC');
    });

    it('extractSkills mendeteksi skill dari kamus', () => {
      const s = extractSkills('Saya menguasai Excel dan berpengalaman dengan Power BI.');
      expect(s).toEqual(expect.arrayContaining(['Excel', 'Power BI']));
    });

    it('extractSkills tetap mendeteksi skill yang terpecah spasi (artefak PDF/run Word)', () => {
      const s = extractSkills('Type Script, Next .js, Postgre SQL, Node .js');
      expect(s).toEqual(expect.arrayContaining(['TypeScript', 'Next.js', 'PostgreSQL']));
    });

    it('matchSkills mencocokkan requirement pada teks skill terpecah spasi', () => {
      const res = matchSkills(
        extractSkills('Type Script, Next .js, Postgre SQL'),
        ['TypeScript', 'Next.js', 'PostgreSQL'],
      );
      expect(res.missing).toEqual([]);
      expect(res.matchRatio).toBe(1);
    });

    it('extractTextFromDocx menyatukan run dalam satu paragraf tanpa spasi', async () => {
      // Bangun DOCX minimal: ZIP berisi word/document.xml dengan kata terpecah run.
      const xml = '<?xml version="1.0"?><w:document><w:body>'
        + '<w:p><w:r><w:t>Type</w:t></w:r><w:r><w:t>Script</w:t></w:r>'
        + '<w:r><w:t>, Next</w:t></w:r><w:r><w:t>.js</w:t></w:r>'
        + '<w:r><w:t>, Postgre</w:t></w:r><w:r><w:t>SQL</w:t></w:r></w:p>'
        + '</w:body></w:document>';
      const docxBuf = buildDocx([{ name: 'word/document.xml', content: xml }]);
      const text = await extractTextFromDocx(docxBuf);
      expect(text).toContain('TypeScript');
      expect(text).toContain('Next.js');
      expect(text).toContain('PostgreSQL');
    });

    it('extractTextFromPdf mendekode stream FlateDecode & merekonstruksi spasi (CV ATS nyata)', () => {
      // Berkas PDF "ATS-friendly" nyata (terkompresi zlib). Sebelum perbaikan,
      // ekstraksi gagal total (teks sampah) sehingga skor ATS = 0.
      const pdfPath = resolve(process.cwd(), 'docs', 'CV ATS Deni Firmansyah.pdf');
      const buf = readFileSync(pdfPath);
      const text = extractTextFromPdf(buf);

      // Harus terbaca sebagai kalimat bermakna, bukan sampah biner.
      expect(text.length).toBeGreaterThan(500);
      expect(text).toContain('Deni Firmansyah');
      expect(text).toContain('TypeScript');
      expect(text).toContain('Next.js');

      // End-to-end: CV ini harus memenuhi lowongan engineering (TypeScript/Next.js/PostgreSQL).
      const parsed = parseResumeHeuristic(text);
      parsed.skills = Array.from(new Set([...(parsed.skills ?? []), ...extractSkills(text)]));
      const jobText = 'Senior Software Engineer TypeScript Next.js PostgreSQL';
      const result = computeAtsScore(parsed, ['TypeScript', 'Next.js', 'PostgreSQL'], jobText, text);
      expect(result.missing).toEqual([]);
      expect(result.score).toBeGreaterThanOrEqual(85);
    });

    it('memulihkan ligatur \'fi\' PDF agar email & kata tidak terpotong (CV ATS nyata)', () => {
      // Regresi: glyph ligatur "fi" (octal \200 / U+FB01) sebelumnya dibuang,
      // sehingga "denifirmansyah@email.com" terbaca "rmansyah@email.com".
      const pdfPath = resolve(process.cwd(), 'docs', 'CV ATS Deni Firmansyah.pdf');
      const buf = readFileSync(pdfPath);
      const text = extractTextFromPdf(buf);
      const parsed = parseResumeHeuristic(text);
      expect(parsed.contact.email).toBe('denifirmansyah181003@email.com');
      // Kata dengan ligatur "fi" harus utuh.
      expect(text).toContain('fixing');
      expect(text).toContain('findings');
      expect(text).toContain('Certificate');
    });

    it('mengelompokkan riwayat pendidikan menjadi satu entri (institusi + tahun)', () => {
      // Regresi: baris institusi & baris tahun sebelumnya jadi entri terpisah,
      // memunculkan kotak riwayat pendidikan kosong di form lamaran.
      const pdfPath = resolve(process.cwd(), 'docs', 'CV ATS Deni Firmansyah.pdf');
      const buf = readFileSync(pdfPath);
      const text = extractTextFromPdf(buf);
      const parsed = parseResumeHeuristic(text);
      // Satu (dan hanya satu) entri pendidikan utama dengan kampus + tahun masuk/lulus.
      const main = parsed.educations.find((e) => /Pesantren Tinggi Darul Ulum/i.test(String(e.institution ?? '')));
      expect(main).toBeTruthy();
      expect(main!.startYear).toBe(2022);
      expect(main!.endYear).toBe(2026);
      // Sertifikat (mis. nomor 2014/2011) tidak boleh jadi entri pendidikan.
      expect(parsed.educations.length).toBeLessThanOrEqual(2);
      expect(parsed.educations.some((e) => e.startYear === 1997 || e.endYear === 2009)).toBe(false);
    });

    it('mengekstrak jenis kelamin, NIK, dan alamat dari CV', () => {
      const cv = `Siti Aminah
siti@example.com | 0812-9999-8888
Jenis Kelamin: Perempuan
NIK: 3201234567890002
Alamat: Jl. Merdeka No. 10, RT 01/RW 02
Kota: Bandung
Provinsi: Jawa Barat
Kode Pos: 40111

RINGKASAN
HR generalist berpengalaman 4 tahun di bidang rekrutmen dan payroll.
`;
      const p = parseResumeHeuristic(cv);
      expect(p.gender).toBe('PEREMPUAN');
      expect(p.nik).toBe('3201234567890002');
      expect(p.address).toContain('Merdeka');
      expect(p.city).toBe('Bandung');
      expect(p.province).toBe('Jawa Barat');
      expect(p.postalCode).toBe('40111');
    });
  });

  describe('computeAtsScore', () => {
    it('memberi skor 0..100 dan breakdown lengkap', () => {
      const parsed = parseResumeHeuristic(SAMPLE_CV);
      const r = computeAtsScore(parsed, ['TypeScript', 'React', 'PostgreSQL', 'Docker']);
      expect(r.score).toBeGreaterThan(0);
      expect(r.score).toBeLessThanOrEqual(100);
      // SAMPLE_CV menyebut keempatnya (Docker ada di bagian KEAHLIAN).
      expect(r.breakdown.skills).toBeCloseTo(1, 5);
      expect(r.matched).toEqual(expect.arrayContaining(['TypeScript', 'React', 'PostgreSQL', 'Docker']));
      expect(r.missing).toEqual([]);
    });

    it('kandidat tanpa skill terhadap requirement tinggi mendapat skor lebih rendah', () => {
      const full = computeAtsScore(parseResumeHeuristic(SAMPLE_CV), ['TypeScript', 'React', 'PostgreSQL']);
      const empty = computeAtsScore(parseResumeHeuristic(''), ['TypeScript', 'React', 'PostgreSQL']);
      expect(full.score).toBeGreaterThan(empty.score);
    });

    it('cosine: CV relevan menghasilkan cosine & skor lebih tinggi dari CV tak relevan', () => {
      const jobText = 'Senior Software Engineer TypeScript React PostgreSQL Docker Next.js platform SaaS';
      const relevant = computeAtsScore(parseResumeHeuristic(SAMPLE_CV), ['TypeScript', 'React', 'PostgreSQL'], jobText, SAMPLE_CV);
      const irrelevant = computeAtsScore(parseResumeHeuristic('HR generalist payroll akuntansi pajak'), ['TypeScript', 'React'], jobText, 'HR generalist payroll akuntansi pajak');
      expect(relevant.cosine).toBeGreaterThan(0);
      expect(relevant.cosine).toBeGreaterThan(irrelevant.cosine);
      expect(relevant.score).toBeGreaterThan(irrelevant.score);
    });

    it('cosine: breakdown.cosine 0..1 dan konsisten dengan AtsResult.cosine', () => {
      const jobText = 'TypeScript React PostgreSQL';
      const r = computeAtsScore(parseResumeHeuristic(SAMPLE_CV), ['TypeScript'], jobText, SAMPLE_CV);
      expect(r.breakdown.cosine).toBeGreaterThanOrEqual(0);
      expect(r.breakdown.cosine).toBeLessThanOrEqual(1);
      expect(r.breakdown.cosine).toBeCloseTo(r.cosine / 100, 5);
    });

    it('kandidat yang MEMENUHI semua skill wajib mendapat skor tinggi (>= 85)', () => {
      // Kandidat Next.Js + TypeScript yang jelas relevan tidak boleh "dinilai salah"
      // hanya karena cosine similarity teks menyeret skor turun.
      const cv = `Andi Pratama
andi@example.com | 0812-3456-7890

RINGKASAN
Frontend developer berpengalaman 4 tahun membangun aplikasi web modern.

KEAHLIAN
Next.Js, TypeScript, React, Tailwind CSS, Node.Js

PENGALAMAN KERJA
Frontend Developer | PT Teknologi Maju | Jan 2020 - Des 2024
Membangun aplikasi dashboard dengan Next.Js dan TypeScript, integrasi REST API.

PENDIDIKAN
S1 Teknik Informatika - Universitas Indonesia (2015 - 2019)
`;
      const parsed = parseResumeHeuristic(cv);
      parsed.skills = Array.from(new Set([...(parsed.skills ?? []), ...extractSkills(cv)]));
      const required = ['Next.Js', 'TypeScript'];
      const jobText = 'Frontend Developer Next.Js TypeScript membangun aplikasi web modern';
      const r = computeAtsScore(parsed, required, jobText, cv);
      expect(r.breakdown.skills).toBe(1);
      expect(r.missing).toEqual([]);
      expect(r.score).toBeGreaterThanOrEqual(85);
    });
  });

  describe('runAts (persist + sinkronisasi DB)', () => {
    let client: PGlite;
    let db: any;
    beforeAll(async () => {
      ({ client, db } = await createTestDb());
      await runSeed(client);
    });
    afterAll(async () => { await client.close(); });

    it('menyimpan resume_parses dan mengisi profil kandidat', async () => {
      // Buat kandidat baru untuk diuji.
      const ins = await client.query<{ id: string }>(
        `INSERT INTO candidates (full_name, email) VALUES ('Uji ATS', 'uji.ats@example.com') RETURNING id`,
      );
      const candidateId = ins.rows[0].id;

      const result = await runAts(db, {
        candidateId,
        resumeText: SAMPLE_CV,
        requiredSkills: ['TypeScript', 'React', 'Docker'],
        useAi: false,
      });
      expect(result.score).toBeGreaterThan(0);
      expect(result.matched).toEqual(expect.arrayContaining(['TypeScript', 'React']));

      // resume_parses tersimpan dan menautkan application_id (null di sini).
      const rp = await client.query<{ ats_score: string; matched_skills: any }>(
        `SELECT ats_score, matched_skills FROM resume_parses WHERE candidate_id = $1::uuid`,
        [candidateId],
      );
      expect(rp.rows.length).toBe(1);
      expect(Number(rp.rows[0].ats_score)).toBeCloseTo(result.score, 1);

      // Profil kandidat tersinkron: skills, educations, experiences.
      const sk = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM candidate_skills WHERE candidate_id = $1::uuid`, [candidateId],
      );
      expect(Number(sk.rows[0].n)).toBeGreaterThan(3);
      const ed = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM candidate_educations WHERE candidate_id = $1::uuid`, [candidateId],
      );
      expect(Number(ed.rows[0].n)).toBeGreaterThanOrEqual(1);
      const ex = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM candidate_experiences WHERE candidate_id = $1::uuid`, [candidateId],
      );
      expect(Number(ex.rows[0].n)).toBeGreaterThanOrEqual(1);
    });

    it('idempoten: re-parse tidak menduplikasi educations/experiences', async () => {
      const ins = await client.query<{ id: string }>(
        `INSERT INTO candidates (full_name, email) VALUES ('Uji ATS 2', 'uji.ats2@example.com') RETURNING id`,
      );
      const candidateId = ins.rows[0].id;
      await runAts(db, { candidateId, resumeText: SAMPLE_CV, requiredSkills: ['React'], useAi: false });
      await runAts(db, { candidateId, resumeText: SAMPLE_CV, requiredSkills: ['React'], useAi: false });
      const ed = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM candidate_educations WHERE candidate_id = $1::uuid`, [candidateId],
      );
      expect(Number(ed.rows[0].n)).toBe(1);
    });

    it('runAts memakai job description posting → cosine & skill cocok', async () => {
      const ins = await client.query<{ id: string }>(
        `INSERT INTO candidates (full_name, email) VALUES ('Uji Cosine', 'uji.cosine@example.com') RETURNING id`,
      );
      const candidateId = ins.rows[0].id;
      const result = await runAts(db, {
        candidateId,
        jobPostingId: '87000000-0000-4000-8000-000000000001',
        resumeText: SAMPLE_CV,
        useAi: false,
      });
      expect(result.required.length).toBeGreaterThan(0);
      expect(result.matched).toEqual(expect.arrayContaining(['TypeScript']));
      expect(result.cosine).toBeGreaterThan(10);
    });

    it('getCandidateReview menghitung ulang skor ATS dari data tersimpan (tidak memakai nilai usang)', async () => {
      const { getCandidateReview } = await import('@/lib/services/candidateReviewService');
      // Kandidat + lamaran untuk lowongan seed (TypeScript, Next.js, PostgreSQL).
      const cand = await client.query<{ id: string }>(
        `INSERT INTO candidates (full_name, email) VALUES ('Uji Recompute', 'uji.recompute@example.com') RETURNING id`,
      );
      const candidateId = cand.rows[0].id;
      const postingId = '87000000-0000-4000-8000-000000000001';
      const job = await client.query<{ job_posting_id: string; application_no: string }>(
        `INSERT INTO job_applications (candidate_id, job_posting_id, application_no, status)
         VALUES ($1::uuid, $2::uuid, 'APP-RECOMP-1', 'SUBMITTED')
         RETURNING job_posting_id, application_no`,
        [candidateId, postingId],
      );
      const appNo = job.rows[0].application_no;
      const app = await client.query<{ id: string }>(
        `SELECT id FROM job_applications WHERE application_no = $1`, [appNo],
      );
      const applicationId = app.rows[0].id;

      // Simpan resume_parses dengan skor SENGAJA rendah (nilai usang/bug lama).
      const cv = `Andi Pratama
andi@example.com | 0812-3456-7890

KEAHLIAN
Next.Js, TypeScript, PostgreSQL

PENGALAMAN KERJA
Frontend Developer | PT Teknologi Maju | Jan 2020 - Des 2024
`;
      await client.query(
        `INSERT INTO resume_parses (candidate_id, application_id, raw_text, ats_score, matched_skills, missing_skills, parser)
         VALUES ($1::uuid, $2::uuid, $3, 12.50, '[]'::jsonb, '[]'::jsonb, 'HEURISTIC')`,
        [candidateId, applicationId, cv],
      );

      const review = await getCandidateReview(db, applicationId);
      expect(review).not.toBeNull();
      // Skor dihitung ulang dari teks CV → jauh lebih tinggi dari 12.50 yang usang.
      expect(review!.atsScore).toBeGreaterThan(50);
      expect(review!.missingSkills).toEqual([]);
      expect(review!.matchedSkills).toEqual(expect.arrayContaining(['TypeScript', 'Next.js', 'PostgreSQL']));
    });
  });
});
