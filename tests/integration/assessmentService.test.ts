import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import {
  scoreCtt,
  getTemplateForType,
  getQuestions,
  startAttempt,
  submitAttempt,
  setInterviewScore,
  recomputeWeightedForApplication,
  getAssessmentScores,
  listTemplates,
  type QuestionRow,
} from '@/lib/services/assessmentService';
import { submitApplication } from '@/lib/services/candidateService';

describe('WS-6 mesin asesmen', () => {
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

  it('bank soal ter-seed: 3 template aktif + jumlah soal benar', async () => {
    const templates = await listTemplates(db);
    expect(templates.length).toBeGreaterThanOrEqual(3);
    const psy = await getTemplateForType(db, 'PSYCHOMETRIC');
    const tech = await getTemplateForType(db, 'TECHNICAL');
    const intr = await getTemplateForType(db, 'INTERVIEW');
    expect(psy?.weight).toBe(30);
    expect(tech?.weight).toBe(40);
    expect(intr?.weight).toBe(30);
    const psyQ = await getQuestions(db, psy!.id);
    const techQ = await getQuestions(db, tech!.id, { includeAnswers: true });
    expect(psyQ.length).toBe(20);
    expect(techQ.length).toBe(8);
    // Kunci jawaban tidak bocor ke kandidat.
    expect(psyQ.every((q) => q.correct_key === null)).toBe(true);
  });

  describe('scoreCtt (murni)', () => {
    const likert: QuestionRow = {
      id: 'q1', order_index: 1, type: 'LIKERT', prompt: 'x',
      options: [
        { key: '1', label: 'a', score: 1 }, { key: '2', label: 'b', score: 2 },
        { key: '3', label: 'c', score: 3 }, { key: '4', label: 'd', score: 4 }, { key: '5', label: 'e', score: 5 },
      ],
      correct_key: null, scale: 'BIG5-C', reverse_scored: false,
    };
    const likertRev: QuestionRow = { ...likert, id: 'q2', reverse_scored: true };
    const mcq: QuestionRow = {
      id: 'q3', order_index: 3, type: 'MCQ', prompt: 'y',
      options: [{ key: 'A', label: 'A' }, { key: 'B', label: 'B' }],
      correct_key: 'B', scale: null, reverse_scored: false,
    };

    it('Likert: nilai tertinggi → 100', () => {
      const r = scoreCtt([likert], [{ questionId: 'q1', answerKey: '5' }]);
      expect(r.score).toBe(100);
    });

    it('Likert reverse: nilai tertinggi → 0', () => {
      const r = scoreCtt([likertRev], [{ questionId: 'q2', answerKey: '5' }]);
      expect(r.score).toBe(0);
    });

    it('MCQ: jawaban benar/menghitung rasio', () => {
      const ok = scoreCtt([mcq], [{ questionId: 'q3', answerKey: 'B' }]);
      expect(ok.score).toBe(100);
      expect(ok.correct).toBe(1);
      const wrong = scoreCtt([mcq], [{ questionId: 'q3', answerKey: 'A' }]);
      expect(wrong.score).toBe(0);
      expect(wrong.correct).toBe(0);
    });

    it('campuran: rasio benar + normalisasi rata-rata', () => {
      const r = scoreCtt([likert, mcq], [
        { questionId: 'q1', answerKey: '5' }, // norm 1
        { questionId: 'q3', answerKey: 'A' }, // 0
      ]);
      expect(r.score).toBe(50);
    });

    it('tanpa jawaban → skor 0 (tidak NaN)', () => {
      const r = scoreCtt([likert, mcq], []);
      expect(r.score).toBe(0);
    });
  });

  describe('attempt lifecycle (DB)', () => {
    it('start → submit teknis menghasilkan skor & attempts SCORED', async () => {
      const app = await submitApplication(db, {
        fullName: 'Peserta Teknis', email: 'peserta.teknis@example.com', jobPostingId: postingId,
      });
      const tech = await getTemplateForType(db, 'TECHNICAL');
      const attempt = await startAttempt(db, {
        applicationId: app.applicationId!, candidateId: app.candidateId, templateId: tech!.id,
      });
      expect(attempt.status).toBe('IN_PROGRESS');
      expect(attempt.questions.length).toBe(8);
      expect(attempt.questions.every((q) => q.correct_key === null)).toBe(true);

      // Jawab semua benar (ambil kunci dari DB internal).
      const withKeys = await getQuestions(db, tech!.id, { includeAnswers: true });
      const responses = withKeys.map((q) => ({ questionId: q.id, answerKey: q.correct_key! }));
      const res = await submitAttempt(db, { applicationId: app.applicationId!, templateId: tech!.id, responses });
      expect(res.score).toBe(100);
      expect(res.correct).toBe(8);

      const scores = await getAssessmentScores(db, app.applicationId!);
      expect(scores.technical).toBe(100);
      // Belum ada psikometri/wawancara → weighted = 100 (dinormalisasi ke bobot tersedia).
      expect(scores.weighted).toBe(100);
    });

    it('idempoten: submit dua kali tidak menduplikasi respons', async () => {
      const app = await submitApplication(db, {
        fullName: 'Peserta Ganda', email: 'peserta.ganda@example.com', jobPostingId: postingId,
      });
      const tech = await getTemplateForType(db, 'TECHNICAL');
      await startAttempt(db, { applicationId: app.applicationId!, candidateId: app.candidateId, templateId: tech!.id });
      const withKeys = await getQuestions(db, tech!.id, { includeAnswers: true });
      const responses = withKeys.map((q) => ({ questionId: q.id, answerKey: q.correct_key! }));
      await submitAttempt(db, { applicationId: app.applicationId!, templateId: tech!.id, responses });
      await submitAttempt(db, { applicationId: app.applicationId!, templateId: tech!.id, responses });
      const r = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM assessment_responses resp
          JOIN assessment_attempts a ON a.id = resp.attempt_id
          WHERE a.application_id = $1::uuid`,
        [app.applicationId],
      );
      expect(Number(r.rows[0].n)).toBe(8);
    });

    it('agregat berbobot 30/40/30 dengan tiga komponen', async () => {
      const app = await submitApplication(db, {
        fullName: 'Peserta Penuh', email: 'peserta.penuh@example.com', jobPostingId: postingId,
      });
      const appId = app.applicationId!;
      const tech = await getTemplateForType(db, 'TECHNICAL');
      const psy = await getTemplateForType(db, 'PSYCHOMETRIC');

      // Teknis: semua benar → 100.
      await startAttempt(db, { applicationId: appId, candidateId: app.candidateId, templateId: tech!.id });
      const techKeys = await getQuestions(db, tech!.id, { includeAnswers: true });
      await submitAttempt(db, {
        applicationId: appId, templateId: tech!.id,
        responses: techKeys.map((q) => ({ questionId: q.id, answerKey: q.correct_key! })),
      });

      // Psikometri: jawab semua "5" (item non-reverse jadi 100, reverse jadi 0) → antara 0..100.
      await startAttempt(db, { applicationId: appId, candidateId: app.candidateId, templateId: psy!.id });
      const psyQ = await getQuestions(db, psy!.id);
      await submitAttempt(db, {
        applicationId: appId, templateId: psy!.id,
        responses: psyQ.map((q) => ({ questionId: q.id, answerKey: '5' })),
      });

      // Wawancara: HR beri 80.
      await setInterviewScore(db, appId, 80);

      const scores = await getAssessmentScores(db, appId);
      expect(scores.technical).toBe(100);
      expect(scores.interview).toBe(80);
      expect(scores.psychometric).not.toBeNull();
      // weighted = (psy*30 + 100*40 + 80*30)/100
      const expected = Math.round(((scores.psychometric * 30 + 100 * 40 + 80 * 30) / 100) * 100) / 100;
      expect(scores.weighted).toBeCloseTo(expected, 1);
    });

    it('setInterviewScore membatasi nilai ke 0..100', async () => {
      const app = await submitApplication(db, {
        fullName: 'Peserta Wawancara', email: 'peserta.wawancara@example.com', jobPostingId: postingId,
      });
      await setInterviewScore(db, app.applicationId!, 150);
      const scores = await getAssessmentScores(db, app.applicationId!);
      expect(scores.interview).toBe(100);
    });

    it('recomputeWeightedForApplication tanpa komponen → weighted null (tidak NaN)', async () => {
      const app = await submitApplication(db, {
        fullName: 'Peserta Kosong', email: 'peserta.kosong@example.com', jobPostingId: postingId,
      });
      const r = await recomputeWeightedForApplication(db, app.applicationId!);
      expect(r.weighted).toBeNull();
    });
  });
});
