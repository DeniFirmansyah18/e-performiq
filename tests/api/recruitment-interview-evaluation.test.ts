import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { POST as scoreInterview } from '@/app/api/v1/recruitment/interviews/score/route';
import { GET as getReview } from '@/app/api/v1/recruitment/candidates/[id]/review/route';
import { rubricToComposite, rubricRecommendation } from '@/lib/services/interviewEvaluationService';

const HR_USER = 'e0000000-0000-4000-8000-000000000002';

function req(path: string, method: string, body: unknown, cookie: string): NextRequest {
  const headers = new Headers({ 'Content-Type': 'application/json', cookie });
  return new NextRequest(`http://localhost:3000${path}`, { method, headers, body: JSON.stringify(body) });
}

describe('Evaluasi wawancara terstruktur (rubrik 7 kriteria) oleh HR', () => {
  let cookie = '';
  let applicationId = '';
  const appNo = `APP-EVAL-${Date.now()}`;

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    await client.exec(`UPDATE job_postings SET is_public = TRUE, status = 'OPEN' WHERE id IN (SELECT id FROM job_postings LIMIT 3);`);
    const q = await client.query<{ id: string }>(`SELECT id FROM job_postings WHERE is_public = TRUE LIMIT 1`);
    cookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: HR_USER, employeeId: null, role: 'HR_MANAGER', email: 'siti.nurhaliza@eperformiq.co.id' })}`;

    const stamp = Date.now().toString(16).padEnd(12, '0').slice(0, 12);
    const candidateId = `ca000000-0000-4000-8000-${stamp}`;
    applicationId = `aa000000-0000-4000-8000-${stamp}`;
    const accountId = `ac000000-0000-4000-8000-${stamp}`;
    const email = `kandidat.eval.${Date.now()}@example.com`;

    await client.query(
      `INSERT INTO candidate_accounts (id, email, password_hash, full_name, is_verified)
       VALUES ($1, $2, 'x', 'Kandidat Evaluasi', TRUE)`,
      [accountId, email],
    );
    await client.query(
      `INSERT INTO candidates (id, full_name, email, account_id) VALUES ($1, 'Kandidat Evaluasi', $2, $3)`,
      [candidateId, email, accountId],
    );
    await client.query(
      `INSERT INTO job_applications (id, application_no, candidate_id, job_posting_id, status)
       VALUES ($1, $2, $3, $4, 'INTERVIEW'::application_status_enum)`,
      [applicationId, appNo, candidateId, q.rows[0].id],
    );
  });

  it('rubricToComposite memetakan skala 1–5 → 0–100', () => {
    // Semua 1 → 0; semua 5 → 100; semua 3 → 50.
    expect(rubricToComposite({ technical_skill: 1, problem_solving: 1 })).toBe(0);
    expect(rubricToComposite({ technical_skill: 5, problem_solving: 5 })).toBe(100);
    expect(rubricToComposite({ technical_skill: 3, problem_solving: 3 })).toBe(50);
    expect(rubricToComposite({})).toBeNull();
    // Ambang rekomendasi.
    expect(rubricRecommendation(90)).toBe('STRONG_HIRE');
    expect(rubricRecommendation(75)).toBe('HIRE');
    expect(rubricRecommendation(60)).toBe('CONSIDER');
    expect(rubricRecommendation(40)).toBe('NO_HIRE');
    expect(rubricRecommendation(null)).toBeNull();
  });

  it('POST skor rubrik menyimpan evaluasi + mengisi skor wawancara pada review', async () => {
    const res = await scoreInterview(req('/x', 'POST', {
      applicationId,
      rubric: {
        technical_skill: 4, problem_solving: 4, communication: 5, collaboration: 4,
        motivation: 5, leadership: 3, professionalism: 5,
      },
      strengths: 'Komunikatif & antusias',
      concerns: 'Pengalaman kepemimpinan terbatas',
      notes: 'Kandidat kuat untuk posisi entry-level.',
    }, cookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    // Rata-rata = (4+4+5+4+5+3+5)/7 = 30/7 ≈ 4.2857 → (4.2857-1)/4*100 ≈ 82.14
    expect(json.data.score).toBeCloseTo(82.14, 1);

    // Evaluasi tampil di kartu review, termasuk skor komposit.
    const reviewRes = await getReview(
      new NextRequest(`http://localhost:3000/x`, { method: 'GET', headers: { cookie } }),
      { params: { id: applicationId } },
    );
    expect(reviewRes.status).toBe(200);
    const review = await reviewRes.json();
    expect(review.data.interviewEvaluation).toBeTruthy();
    expect(review.data.interviewEvaluation.scores.technical_skill).toBe(4);
    expect(review.data.interviewEvaluation.compositeScore).toBeCloseTo(82.14, 1);
    expect(review.data.interviewEvaluation.recommendation).toBe('HIRE');
    expect(review.data.interviewScore).toBeCloseTo(82.14, 1);
  });

  it('rubrik parsial hanya menghitung kriteria yang terisi', async () => {
    const stamp2 = Date.now().toString(16).padEnd(12, '1').slice(0, 12);
    const client = await getDb();
    const q = await client.query<{ id: string }>(`SELECT id FROM job_postings WHERE is_public = TRUE LIMIT 1`);
    const candidateId = `cb000000-0000-4000-8000-${stamp2}`;
    const accountId = `ad000000-0000-4000-8000-${stamp2}`;
    const appId = `ab000000-0000-4000-8000-${stamp2}`;
    const email = `kandidat.eval2.${Date.now()}@example.com`;
    await client.query(
      `INSERT INTO candidate_accounts (id, email, password_hash, full_name, is_verified) VALUES ($1, $2, 'x', 'K2', TRUE)`,
      [accountId, email],
    );
    await client.query(`INSERT INTO candidates (id, full_name, email, account_id) VALUES ($1, 'K2', $2, $3)`, [candidateId, email, accountId]);
    await client.query(
      `INSERT INTO job_applications (id, application_no, candidate_id, job_posting_id, status)
       VALUES ($1, $2, $3, $4, 'INTERVIEW'::application_status_enum)`,
      [appId, `APP-EVAL2-${Date.now()}`, candidateId, q.rows[0].id],
    );

    const res = await scoreInterview(req('/x', 'POST', {
      applicationId: appId,
      rubric: { technical_skill: 5, communication: 5 },
    }, cookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    // Hanya 2 kriteria bernilai 5 → komposit 100.
    expect(json.data.score).toBe(100);
  });

  it('tanpa skor maupun rubrik → 400', async () => {
    const res = await scoreInterview(req('/x', 'POST', { applicationId }, cookie));
    expect(res.status).toBe(400);
  });
});
