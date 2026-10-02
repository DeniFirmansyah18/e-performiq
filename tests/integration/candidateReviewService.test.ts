import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import {
  computeOverallScore,
  recommend,
  recommendationLabel,
  fallbackSummary,
  getCandidateReview,
  getCandidateReviewWithAi,
  recordDecision,
  listReviewQueue,
} from '@/lib/services/candidateReviewService';
import { submitApplication } from '@/lib/services/candidateService';
import { runAts } from '@/lib/services/atsService';
import { getTemplateForType, getQuestions, startAttempt, submitAttempt, setInterviewScore } from '@/lib/services/assessmentService';

const CV = `Dewi Anggraini
dewi.anggraini@example.com | 0812-7777-8888

RINGKASAN
Engineer dengan 6 tahun pengalaman membangun sistem backend menggunakan TypeScript,
Node.js, PostgreSQL, dan Docker untuk produk skala besar.

PENGALAMAN KERJA
Senior Backend Engineer | PT Nusantara Digital | Jan 2019 - Sekarang
Memimpin tim mengembangkan layanan microservices.

PENDIDIKAN
S1 Teknik Informatika, Institut Teknologi Bandung, 2013 - 2017, IPK 3.70

KEAHLIAN
TypeScript, Node.js, PostgreSQL, Docker, Kubernetes, Komunikasi, Kepemimpinan
`;

describe('WS-7 review HR + keputusan', () => {
  let client: PGlite;
  let db: any;
  let postingId: string;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
    await client.exec(`UPDATE job_postings SET is_public = TRUE, status = 'OPEN' WHERE id IN (SELECT id FROM job_postings LIMIT 3);`);
    const q = await client.query<{ id: string }>(`SELECT id FROM job_postings WHERE is_public = TRUE LIMIT 1`);
    postingId = q.rows[0].id;
  });
  afterAll(async () => { await client.close(); });

  describe('fungsi murni', () => {
    it('computeOverallScore: 40% ATS + 60% weighted', () => {
      expect(computeOverallScore(80, 90)).toBeCloseTo(86, 5);
      expect(computeOverallScore(80, null)).toBe(80);
      expect(computeOverallScore(null, 90)).toBe(90);
      expect(computeOverallScore(null, null)).toBeNull();
    });

    it('recommend: ambang batas & data kurang', () => {
      const base = { psychometric: null, technical: null, interview: null };
      expect(recommend({ ...base, ats: 95, weighted: null, hasAts: true, hasAssessment: false })).toBe('STRONG_HIRE');
      expect(recommend({ ...base, ats: 75, weighted: null, hasAts: true, hasAssessment: false })).toBe('HIRE');
      expect(recommend({ ...base, ats: 60, weighted: null, hasAts: true, hasAssessment: false })).toBe('CONSIDER');
      expect(recommend({ ...base, ats: 40, weighted: null, hasAts: true, hasAssessment: false })).toBe('NO_HIRE');
      expect(recommend({ ...base, ats: null, weighted: null, hasAts: false, hasAssessment: false })).toBe('INSUFFICIENT_DATA');
    });

    it('recommendationLabel mengembalikan label Indonesia', () => {
      expect(recommendationLabel('STRONG_HIRE')).toContain('Direkomendasikan');
      expect(recommendationLabel('INSUFFICIENT_DATA')).toBe('Data Belum Cukup');
    });
  });

  describe('agregasi & keputusan (DB)', () => {
    let applicationId: string;
    let candidateId: string;

    it('menyiapkan kandidat dengan ATS + asesmen', async () => {
      const app = await submitApplication(db, {
        fullName: 'Dewi Anggraini', email: 'dewi.anggraini@example.com', jobPostingId: postingId,
      });
      applicationId = app.applicationId!;
      candidateId = app.candidateId;

      // ATS.
      await runAts(db, {
        candidateId, applicationId, jobPostingId: postingId, resumeText: CV,
        requiredSkills: ['TypeScript', 'Node.js', 'PostgreSQL', 'Docker'], useAi: false,
      });
      // Teknis: semua benar.
      const tech = await getTemplateForType(db, 'TECHNICAL');
      await startAttempt(db, { applicationId, candidateId, templateId: tech!.id });
      const keys = await getQuestions(db, tech!.id, { includeAnswers: true });
      await submitAttempt(db, { applicationId, templateId: tech!.id, responses: keys.map((q) => ({ questionId: q.id, answerKey: q.correct_key! })) });
      // Wawancara: 80.
      await setInterviewScore(db, applicationId, 80);
    });

    it('getCandidateReview mengagregasi skor dari semua sumber', async () => {
      const r = await getCandidateReview(db, applicationId);
      expect(r).not.toBeNull();
      expect(r!.candidateName).toBe('Dewi Anggraini');
      expect(r!.atsScore).not.toBeNull();
      expect(r!.atsScore!).toBeGreaterThan(0);
      expect(r!.technicalScore).toBe(100);
      expect(r!.interviewScore).toBe(80);
      expect(r!.finalWeightedScore).not.toBeNull();
      expect(r!.matchedSkills).toEqual(expect.arrayContaining(['TypeScript', 'Node.js']));
      expect(r!.topSkills.length).toBeGreaterThan(0);
      expect(['STRONG_HIRE', 'HIRE', 'CONSIDER', 'NO_HIRE']).toContain(r!.recommendation);
      expect(r!.decision).toBe('PENDING');
    });

    it('fallbackSummary menghasilkan ringkasan non-kosong tanpa AI', async () => {
      const r = await getCandidateReview(db, applicationId);
      const s = fallbackSummary(r!);
      expect(s.length).toBeGreaterThan(40);
      expect(s).toContain('Dewi Anggraini');
    });

    it('getCandidateReviewWithAi selalu mengembalikan ringkasan (fallback bila AI off)', async () => {
      const res = await getCandidateReviewWithAi(db, applicationId);
      expect(res).not.toBeNull();
      expect(res!.aiSummary.trim().length).toBeGreaterThan(20);
    });

    it('recordDecision ACCEPTED → status OFFERED + timeline DECISION', async () => {
      const userRes = await client.query<{ id: string }>(`SELECT id FROM users LIMIT 1`);
      const userId = userRes.rows[0].id;
      const decision = await recordDecision(db, {
        applicationId, decidedByUserId: userId, decision: 'ACCEPTED', notes: 'Kandidat kuat.',
      });
      expect(decision).toBe('ACCEPTED');

      const app = await client.query<{ status: string }>(
        `SELECT status FROM job_applications WHERE id = $1::uuid`, [applicationId],
      );
      expect(app.rows[0].status).toBe('OFFERED');

      const tl = await client.query<{ status: string }>(
        `SELECT status FROM application_timeline WHERE application_id = $1::uuid AND stage = 'DECISION'`,
        [applicationId],
      );
      expect(tl.rows[0]?.status).toBe('PASSED');

      const r2 = await getCandidateReview(db, applicationId);
      expect(r2!.decision).toBe('ACCEPTED');
    });

    it('recordDecision REJECTED → status REJECTED + timeline DECISION FAILED', async () => {
      const app2 = await submitApplication(db, {
        fullName: 'Kandidat Tolak', email: 'kandidat.tolak@example.com', jobPostingId: postingId,
      });
      const userRes = await client.query<{ id: string }>(`SELECT id FROM users LIMIT 1`);
      await recordDecision(db, {
        applicationId: app2.applicationId!, decidedByUserId: userRes.rows[0].id, decision: 'REJECTED',
      });
      const app = await client.query<{ status: string }>(
        `SELECT status FROM job_applications WHERE id = $1::uuid`, [app2.applicationId],
      );
      expect(app.rows[0].status).toBe('REJECTED');
      const tl = await client.query<{ status: string }>(
        `SELECT status FROM application_timeline WHERE application_id = $1::uuid AND stage = 'DECISION'`,
        [app2.applicationId],
      );
      expect(tl.rows[0]?.status).toBe('FAILED');
    });

    it('recordDecision idempoten (upsert satu baris)', async () => {
      const userRes = await client.query<{ id: string }>(`SELECT id FROM users LIMIT 1`);
      await recordDecision(db, { applicationId, decidedByUserId: userRes.rows[0].id, decision: 'TALENT_POOL', notes: 'cadangan' });
      await recordDecision(db, { applicationId, decidedByUserId: userRes.rows[0].id, decision: 'ACCEPTED', notes: 'final' });
      const r = await client.query<{ n: string; decision: string }>(
        `SELECT COUNT(*)::text AS n, MAX(decision::text) AS decision FROM candidate_decisions WHERE application_id = $1::uuid`,
        [applicationId],
      );
      expect(Number(r.rows[0].n)).toBe(1);
      expect(r.rows[0].decision).toBe('ACCEPTED');
    });

    it('recordDecision pada lamaran tak ada → melempar error', async () => {
      const userRes = await client.query<{ id: string }>(`SELECT id FROM users LIMIT 1`);
      await expect(
        recordDecision(db, { applicationId: '00000000-0000-4000-8000-000000000000', decidedByUserId: userRes.rows[0].id, decision: 'ACCEPTED' }),
      ).rejects.toThrow();
    });

    it('listReviewQueue mengembalikan baris dengan skor teragregasi', async () => {
      const queue = await listReviewQueue(db);
      expect(queue.length).toBeGreaterThanOrEqual(1);
      const row = queue.find((q: any) => q.applicationId === applicationId);
      expect(row).toBeTruthy();
      expect(row.atsScore).not.toBeNull();
    });
  });
});
