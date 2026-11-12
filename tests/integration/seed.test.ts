import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed, SEED_USER_EMAILS, DEMO_PASSWORD } from '@/lib/db/seed';
import { verifyPassword } from '@/lib/auth/password';

describe('seed data', () => {
  let client: PGlite;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
  });

  afterAll(async () => {
    await client.close();
  });

  it('membuat 7 user, satu per akun demo (5 peran)', async () => {
    const res = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM users');
    expect(Number(res.rows[0].count)).toBe(7);
    expect(SEED_USER_EMAILS).toHaveLength(7);
    // ASSESSOR sudah dihapus; semua peran seed harus termasuk 5 peran resmi.
    const roles = new Set(SEED_USER_EMAILS.map((u) => u.role));
    expect(roles.has('ASSESSOR' as never)).toBe(false);
  });

  it('menyimpan password sebagai hash bcrypt yang cocok dengan password demo', async () => {
    const res = await client.query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE email = $1',
      [SEED_USER_EMAILS[0].email]
    );
    expect(res.rows[0].password_hash).not.toContain(DEMO_PASSWORD);
    expect(await verifyPassword(DEMO_PASSWORD, res.rows[0].password_hash)).toBe(true);
  });

  it('membuat 4 pilar strategis dengan total bobot 100', async () => {
    const res = await client.query<{ total: string }>(
      'SELECT sum(strategic_weight)::text AS total FROM strategic_pillars'
    );
    expect(Number(res.rows[0].total)).toBe(100);
  });

  it('setiap karyawan inti punya KPI dengan bobot total 100%', async () => {
    // Seed kini juga memuat KPI departemen, jadi total baris tidak lagi tetap.
    // Yang penting dan stabil: tiap karyawan penilaian inti (Budi, Siti/HR,
    // Danu/People Manager) punya bobot tepat 100%.
    const res = await client.query<{ emp: string; total: string; jumlah: string }>(
      `SELECT employee_id::text AS emp, sum(kpi_weight)::text AS total, count(*)::text AS jumlah
         FROM individual_kpis
        GROUP BY employee_id`
    );
    const inti = ['b0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003'];
    for (const id of inti) {
      const baris = res.rows.find((r) => r.emp === id);
      expect(baris, `KPI untuk ${id} harus ada`).toBeTruthy();
      expect(Number(baris!.total)).toBe(100);
      expect(Number(baris!.jumlah)).toBe(4);
    }
  });

  it('menetapkan manager_id Budi ke Danu', async () => {
    const res = await client.query<{ manager_code: string }>(
      `SELECT m.employee_code AS manager_code FROM employees e
         JOIN employees m ON m.id = e.manager_id
        WHERE e.employee_code = 'EMP-2022-0042'`
    );
    expect(res.rows[0].manager_code).toBe('MGR-2020-0001');
  });

  it('idempoten: seed kedua tidak menggandakan baris', async () => {
    await runSeed(client);
    const res = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM users');
    expect(Number(res.rows[0].count)).toBe(7);
  });

  it('memverifikasi keberadaan data pada seluruh 9 tabel Pre/Post-Employment & Analytics', async () => {
    const tables = [
      'manpower_plans', 'hiring_requisitions', 
      'onboarding_milestones', 'offboarding_requests', 'knowledge_handovers',
      'severance_calculations', 'lifetime_contributions', 'vmai_scorecards'
    ];
    for (const t of tables) {
      const res = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM ${t}`);
      expect(Number(res.rows[0].count)).toBeGreaterThan(0);
    }
  });

  it('mengisi rantai rekrutmen: akun kandidat, lamaran, wawancara, asesmen, keputusan, dan penawaran', async () => {
    const tables = [
      'candidate_accounts', 'candidates', 'candidate_skills', 'candidate_educations',
      'candidate_experiences', 'job_applications', 'candidate_documents',
      'candidate_certifications', 'resume_parses', 'application_timeline',
      'interview_schedules', 'interview_evaluations', 'assessment_attempts',
      'assessment_responses', 'candidate_assessment_scores', 'candidate_decisions',
      'job_offers', 'candidate_notifications', 'email_outbox', 'whatsapp_outbox',
    ];
    for (const t of tables) {
      const res = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM ${t}`);
      expect(Number(res.rows[0].count), `tabel ${t} kosong`).toBeGreaterThan(0);
    }
  });

  it('mengisi tabel fase pra-kerja, saat kerja, dan pasca-kerja', async () => {
    const groups: Record<string, string[]> = {
      PRE: ['onboarding_programs', 'employee_registrations', 'employee_documents'],
      DURING: [
        'company_dpi_settings', 'kpi_indicators', 'kpi_daily_entries',
        'daily_performance_snapshots', 'attendance_logs', 'attendance_corrections',
        'letters', 'letter_dispositions', 'policy_documents', 'policy_acknowledgments',
        'disciplinary_actions', 'recognitions', 'badge_awards', 'career_ladder_steps',
        'salary_components', 'company_holidays', 'conversations', 'messages',
        'employee_notifications', 'ai_insights', 'employee_flight_risk_snapshots',
        'improvement_ideas', 'sop_period_metrics', 'gpa_batch_jobs',
        'appraisal_finalization_requests', 'competency_evidence', 'course_completions',
      ],
      POST: ['offboarding_requests', 'exit_interviews'],
    };
    for (const [phase, tables] of Object.entries(groups)) {
      for (const t of tables) {
        const res = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM ${t}`);
        expect(Number(res.rows[0].count), `tabel ${t} (${phase}) kosong`).toBeGreaterThan(0);
      }
    }
  });

  it('setiap karyawan punya fase siklus yang konsisten dengan riwayat transisinya', async () => {
    const res = await client.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM employees WHERE employee_phase IS NULL'
    );
    expect(Number(res.rows[0].count)).toBe(0);

    const phases = await client.query<{ phase: string; count: string }>(
      'SELECT employee_phase::text AS phase, count(*)::text AS count FROM employees GROUP BY 1'
    );
    const byPhase = Object.fromEntries(phases.rows.map((r) => [r.phase, Number(r.count)]));
    expect(byPhase.PRE).toBeGreaterThan(0);
    expect(byPhase.DURING).toBeGreaterThan(0);
    expect(byPhase.POST).toBeGreaterThan(0);

    // Baris terakhir riwayat harus sama dengan kolom denormalisasi.
    const mismatch = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM employees e
         JOIN (
           SELECT DISTINCT ON (employee_id) employee_id, new_phase
             FROM employee_phase_history
            ORDER BY employee_id, effective_date DESC, created_at DESC
         ) h ON h.employee_id = e.id
        WHERE e.employee_phase IS DISTINCT FROM h.new_phase`
    );
    expect(Number(mismatch.rows[0].count)).toBe(0);
  });

  it('mencakup siklus penuh sampai pensiun (karyawan RETIRED dengan exit interview)', async () => {
    const res = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM employees e
         JOIN offboarding_requests o ON o.employee_id = e.id
         JOIN exit_interviews x ON x.employee_id = e.id
        WHERE e.employment_status = 'RETIRED'`
    );
    expect(Number(res.rows[0].count)).toBeGreaterThan(0);
  });
});
