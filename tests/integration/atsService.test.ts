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
import { parseResumeHeuristic, extractSkills } from '@/lib/services/resumeParser';

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
  });
});
