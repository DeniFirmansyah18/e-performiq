import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import {
  listPositionCourses,
  generateOnboardingProgram,
  getOnboardingStatus,
  refreshOnboardingStatus,
  onCourseCompletedForOnboarding,
} from '@/lib/services/onboardingService';
import { completeCourse } from '@/lib/services/learningLmsService';
import { getCertificatesForEmployee } from '@/lib/services/certificateService';

// Posisi Senior Software Engineer (punya 4 kursus, 4 wajib).
const POS_SWE = 'a0000000-0000-4000-8000-000000000204';

describe('WS-8 onboarding LMS per-posisi + e-sertifikat', () => {
  let client: PGlite;
  let db: any;
  let employeeId: string;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
    // Karyawan baru (fresh) di posisi Senior Software Engineer.
    const ins = await client.query<{ id: string }>(
      `INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
       VALUES (gen_random_uuid(), 'EMP-NEW-9001', 'Karyawan Baru', 'karyawan.baru@eperformiq.co.id',
               'a0000000-0000-4000-8000-000000000101'::uuid, '${POS_SWE}'::uuid, 'PROBATION', 12000000, CURRENT_DATE)
       RETURNING id`,
    );
    employeeId = ins.rows[0].id;
  });
  afterAll(async () => { await client.close(); });

  it('position_courses ter-seed untuk posisi SWE (4 kursus, semua wajib)', async () => {
    const courses = await listPositionCourses(db, POS_SWE);
    expect(courses.length).toBe(4);
    expect(courses.every((c) => c.isMandatory)).toBe(true);
    expect(courses.map((c) => c.courseCode)).toEqual(expect.arrayContaining(['ONB-101', 'AKHLAK-CULTURE', 'CLOUD-ARCH', 'PG-ADV']));
  });

  it('generateOnboardingProgram membuat program + plan + enrollment kursus wajib', async () => {
    const res = await generateOnboardingProgram(db, { employeeId });
    expect(res.planId).toBeTruthy();
    // 4 kursus seed + 1 kurikulum onboarding per-posisi hasil generate = 5 wajib.
    expect(res.enrolled).toBe(5);

    const status = await getOnboardingStatus(db, employeeId);
    expect(status.programId).toBeTruthy();
    expect(status.totalMandatory).toBe(5);
    expect(status.completedMandatory).toBe(0);
    expect(status.items.filter((i) => i.enrolled).length).toBe(5);
    expect(status.progressPct).toBe(0);

    // Kurikulum onboarding per-posisi benar-benar dibuat (kursus nyata + modul).
    const onb = await client.query<{ id: number }>(
      `SELECT id FROM moodle_courses WHERE course_code = 'ONB-A0000000'`,
    );
    expect(onb.rows[0]?.id).toBeTruthy();
    const mods = await client.query<{ n: string; quiz: string }>(
      `SELECT COUNT(*)::text AS n, COUNT(*) FILTER (WHERE content_type='QUIZ')::text AS quiz
         FROM course_modules WHERE course_id = $1`, [onb.rows[0].id],
    );
    expect(Number(mods.rows[0].n)).toBeGreaterThanOrEqual(3);
    expect(Number(mods.rows[0].quiz)).toBeGreaterThanOrEqual(1);

    // Learning plan + item terbuat.
    const items = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM learning_plan_items WHERE plan_id = $1::uuid`, [res.planId],
    );
    expect(Number(items.rows[0].n)).toBe(5);
  });

  it('idempoten: generate dua kali tidak menduplikasi program/enrollment', async () => {
    await generateOnboardingProgram(db, { employeeId });
    const prog = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM onboarding_programs WHERE employee_id = $1::uuid`, [employeeId],
    );
    expect(Number(prog.rows[0].n)).toBe(1);
    const enr = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM moodle_course_enrollments WHERE employee_id = $1::uuid`, [employeeId],
    );
    expect(Number(enr.rows[0].n)).toBe(5);
  });

  it('menyelesaikan semua kursus wajib → program COMPLETED + e-sertifikat terbit', async () => {
    const status = await getOnboardingStatus(db, employeeId);
    const mandatory = status.items.filter((i) => i.isMandatory);

    // Selesaikan kursus satu per satu via completeCourse (memicu onboarding hook).
    for (const c of mandatory) {
      await completeCourse(db, employeeId, c.courseId);
    }

    const after = await getOnboardingStatus(db, employeeId);
    expect(after.completedMandatory).toBe(5);
    expect(after.progressPct).toBe(100);
    expect(after.status).toBe('COMPLETED');

    // Sertifikat terbit untuk SEMUA kursus wajib.
    const certs = await getCertificatesForEmployee(db, employeeId);
    expect(certs.length).toBe(5);

    // Item plan DONE.
    const items = await client.query<{ done: string; total: string }>(
      `SELECT COUNT(*) FILTER (WHERE status='DONE')::text AS done, COUNT(*)::text AS total
         FROM learning_plan_items WHERE plan_id = $1::uuid`, [status.planId],
    );
    expect(items.rows[0].done).toBe(items.rows[0].total);
  });

  it('e-sertifikat idempoten (tidak terbit ganda)', async () => {
    const before = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM certificates WHERE employee_id = $1::uuid`, [employeeId],
    );
    await refreshOnboardingStatus(db, employeeId);
    const after = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM certificates WHERE employee_id = $1::uuid`, [employeeId],
    );
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it('onCourseCompletedForOnboarding mengembalikan null bila tidak ada program aktif', async () => {
    // Program sudah COMPLETED → hook mengembalikan null.
    const r = await onCourseCompletedForOnboarding(db, employeeId);
    expect(r).toBeNull();
  });

  it('karyawan di posisi tanpa kurikulum: generate membuat kurikulum onboarding nyata', async () => {
    const ins = await client.query<{ id: string }>(
      `INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
       SELECT gen_random_uuid(), 'EMP-NEW-9002', 'Tanpa Posisi', 'tanpa.posisi@eperformiq.co.id',
              'a0000000-0000-4000-8000-000000000101'::uuid, id, 'PROBATION', 8000000, CURRENT_DATE
         FROM job_positions WHERE id NOT IN (SELECT position_id FROM position_courses) LIMIT 1
       RETURNING id`,
    );
    if (ins.rows[0]) {
      const res = await generateOnboardingProgram(db, { employeeId: ins.rows[0].id });
      // Posisi ini awalnya tanpa kurikulum; generate kini membuat 1 kursus onboarding nyata.
      expect(res.enrolled).toBe(1);
      const status = await getOnboardingStatus(db, ins.rows[0].id);
      expect(status.totalMandatory).toBe(1);
      expect(status.progressPct).toBe(0);
    }
  });
});
