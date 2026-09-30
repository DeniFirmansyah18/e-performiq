import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import type { Db } from '@/lib/db/client';
import { runSeed } from '@/lib/db/seed';
import {
  screenCvAgainstPosting,
  applyToPosting,
  approveApplication,
  bookInterviewSlot,
} from '@/lib/services/talentAcquisitionService';
import { BusinessRuleError } from '@/lib/auth/errors';

describe('Screening CV deterministik', () => {
  it('memberi skor 100 ketika seluruh skill wajib terpenuhi', () => {
    const result = screenCvAgainstPosting(
      ['Kubernetes', 'TypeScript', 'AWS'],
      ['Kubernetes', 'TypeScript']
    );
    expect(result.score).toBe(100);
  });

  it('skor proporsional dengan skill yang cocok', () => {
    const result = screenCvAgainstPosting(
      ['Kubernetes', 'Go'],
      ['Kubernetes', 'TypeScript', 'AWS', 'Terraform']
    );
    expect(result.score).toBe(25);
  });

  it('mengembalikan 0 bila tidak ada skill yang cocok', () => {
    const result = screenCvAgainstPosting(['COBOL'], ['Kubernetes', 'AWS']);
    expect(result.score).toBe(0);
  });

  it('menghindari false positive untuk kemiripan teks', () => {
    const result = screenCvAgainstPosting(['Java'], ['JavaScript']);
    expect(result.score).toBe(0);
  });
});

describe('Job Board Kotak 3 (P1)', () => {
  let client: PGlite;
  let db: Db;
  let postingId: string;
  let applicantA: string;
  let applicantB: string;
  let slotId: string;

  async function insertEmployee(code: string, name: string, email: string, depId: string, posId: string) {
    const res = await client.query<{ id: string }>(
      `INSERT INTO employees (employee_code, full_name, email, department_id, position_id, base_salary, join_date)
       VALUES ($1, $2, $3, $4::uuid, $5::uuid, 8000000, CURRENT_DATE) RETURNING id`,
      [code, name, email, depId, posId]
    );
    return res.rows[0].id;
  }

  beforeAll(async () => {
    ({ db, client } = await createTestDb());
    await runSeed(client);

    const depId = (await client.query<{ id: string }>('SELECT id FROM departments LIMIT 1')).rows[0].id;
    const posId = (await client.query<{ id: string }>('SELECT id FROM job_positions LIMIT 1')).rows[0].id;
    const periodId = (await client.query<{ id: string }>('SELECT id FROM appraisal_periods LIMIT 1')).rows[0].id;

    // Manpower plan dengan kuota 1 agar penolakan kuota teruji
    const mp = await client.query<{ id: string }>(
      `INSERT INTO manpower_plans (department_id, position_id, fiscal_year, approved_quota, allocated_budget, hired_count)
       VALUES ($1::uuid, $2::uuid, 2026, 1, 100000000, 0) RETURNING id`,
      [depId, posId]
    );

    const jp = await client.query<{ id: string }>(
      `INSERT INTO job_postings (manpower_plan_id, position_id, department_id, posting_title, description, required_skills, status)
       VALUES ($1::uuid, $2::uuid, $3::uuid, 'DevOps Engineer', 'Uji', $4::jsonb, 'OPEN') RETURNING id`,
      [mp.rows[0].id, posId, depId, JSON.stringify(['Kubernetes', 'TypeScript'])]
    );
    postingId = jp.rows[0].id;

    applicantA = await insertEmployee('T-APL-A', 'Pelamar A', 'pelamar.a@example.com', depId, posId);
    applicantB = await insertEmployee('T-APL-B', 'Pelamar B', 'pelamar.b@example.com', depId, posId);

    // Skill CV pelamar A: cocok penuh; pelamar B: tanpa skill tercatat
    for (const skill of ['Kubernetes', 'TypeScript']) {
      await client.query(
        `INSERT INTO competency_scores (period_id, employee_id, skill_name, skill_category, required_level, actual_level, score)
         VALUES ($1::uuid, $2::uuid, $3, 'HARD', 3, 4, 85)`,
        [periodId, applicantA, skill]
      );
    }

    const sl = await client.query<{ id: string }>(
      `INSERT INTO interview_slots (job_posting_id, scheduled_date, start_time, end_time, capacity, booked_count)
       VALUES ($1::uuid, CURRENT_DATE + 7, '09:00', '10:00', 1, 0) RETURNING id`,
      [postingId]
    );
    slotId = sl.rows[0].id;
  });

  afterAll(async () => {
    await client.close();
  });

  it('applyToPosting menghitung skor screening dari competency_scores', async () => {
    const app = await applyToPosting(
      db, applicantA, postingId,
      'Saya tertarik dengan posisi ini.', 'https://example.com/cv-a.pdf'
    );
    expect(app.screeningScore).toBe(100);
    expect(app.status).toBe('SUBMITTED');
  });

  it('menolak lamaran ganda untuk lowongan yang sama', async () => {
    await expect(
      applyToPosting(db, applicantA, postingId, 'Lamaran kedua.', 'https://example.com/cv-a.pdf')
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('approveApplication menambah hired_count; pelamar kedua ditolak kuota', async () => {
    const appB = await applyToPosting(
      db, applicantB, postingId,
      'Saya juga berminat.', 'https://example.com/cv-b.pdf'
    );
    expect(appB.screeningScore).toBe(0);

    const apps = await client.query<{ id: string }>(
      `SELECT id FROM internal_applications WHERE job_posting_id = $1::uuid ORDER BY created_at`,
      [postingId]
    );

    const first = await approveApplication(db, apps.rows[0].id);
    expect(first.status).toBe('OFFERED');

    await expect(approveApplication(db, apps.rows[1].id)).rejects.toThrow(
      /Kuota formasi telah tercapai/
    );
  });

  it('bookInterviewSlot menolak bila kapasitas penuh', async () => {
    const first = await bookInterviewSlot(db, slotId);
    expect(first.bookedCount).toBe(1);
    expect(first.isAvailable).toBe(false);

    await expect(bookInterviewSlot(db, slotId)).rejects.toBeInstanceOf(BusinessRuleError);
  });
});
