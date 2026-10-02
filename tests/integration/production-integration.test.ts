import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';

// WS-0.3 — Verifikasi integrasi data nyata lintas-alur (bukan demo).
// Alur: KPI → GPA → VMAI · absensi/timesheet → payroll · LMS → sertifikat.

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const PERIOD = 'd0000000-0000-4000-8000-000000000001';

describe('WS-0.3 integrasi produksi (end-to-end dari data seed nyata)', () => {
  let client: PGlite;
  let db: Db;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  });
  afterAll(async () => { await client.close(); });

  // ---------- Alur 1: KPI → GPA → VMAI ----------
  it('KPI individu tersimpan & tertaut pilar (bukan dummy)', async () => {
    const res = await db.execute<any>(`
      SELECT COUNT(*)::int AS n FROM individual_kpis WHERE employee_id = '${BUDI}'::uuid
    `);
    const rows = (res as any).rows;
    expect(rows[0].n).toBeGreaterThanOrEqual(1);
    // setiap KPI wajib punya strategic_pillar_id (linked, non-dummy)
    const linked = await db.execute<any>(`
      SELECT COUNT(*)::int AS n FROM individual_kpis
       WHERE employee_id = '${BUDI}'::uuid AND strategic_pillar_id IS NOT NULL
    `);
    expect((linked as any).rows[0].n).toBe(rows[0].n);
  });

  it('GPA tersimpan konsisten dgn formula 50/20/15/15', async () => {
    const res = await db.execute<any>(`
      SELECT kpi_composite_score, sop_compliance_score, competency_score, core_values_score,
             composite_gpa, nine_box_quadrant
        FROM performance_appraisals
       WHERE employee_id = '${BUDI}'::uuid AND period_id = '${PERIOD}'::uuid
    `);
    const row = (res as any).rows[0];
    expect(row).toBeTruthy();
    const expected = row.kpi_composite_score * 0.5 + row.sop_compliance_score * 0.2 +
      row.competency_score * 0.15 + row.core_values_score * 0.15;
    expect(Math.abs(expected - Number(row.composite_gpa) * 22.5)).toBeLessThan(15); // skala 4.0 vs %
    expect(row.nine_box_quadrant).toBeTruthy();
  });

  it('VMAI diagregasi dari pilar nyata (bukan konstanta)', async () => {
    const { getVmaiScorecardData } = await import('@/lib/services/analyticsService');
    const scorecard = await getVmaiScorecardData(db, '2026-Q3');
    expect(Number.isFinite(Number((scorecard as any).overallVMAI))).toBe(true);
    expect((scorecard as any).overallVMAI).toBeGreaterThan(0);
  });

  // ---------- Alur 2: absensi/timesheet → payroll ----------
  it('absensi nyata tersimpan untuk periode (bukan angka hiasan)', async () => {
    const res = await db.execute<any>(`
      SELECT COUNT(*)::int AS n, COALESCE(SUM(total_overtime_hours),0) AS ot
        FROM attendance_records WHERE employee_id = '${BUDI}'::uuid
    `);
    const row = (res as any).rows[0];
    expect(row.n).toBeGreaterThan(0);
    expect(Number(row.ot)).toBeGreaterThanOrEqual(0);
  });

  it('timesheet harian terhubung absensi (rekap menyatu)', async () => {
    const res = await db.execute<any>(`
      SELECT COUNT(*)::int AS n FROM daily_timesheets WHERE employee_id = '${BUDI}'::uuid
    `);
    expect((res as any).rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it('slip gaji terverifikasi PIN & komponen lengkap (gaji/BPJS/PPh21)', async () => {
    const { getVerifiedPayslip } = await import('@/lib/services/payrollFinanceService');
    // PIN demo seed = 123456 (di-hash)
    const slip = await getVerifiedPayslip({ employeeId: BUDI, pin: '123456' });
    expect(slip.earnings.baseSalary).toBeGreaterThan(0);
    expect(slip.earnings.fixedAllowance).toBeGreaterThan(0);
    expect(slip.deductions.bpjsKetenagakerjaan).toBeGreaterThan(0);
    expect(slip.deductions.pph21).toBeGreaterThan(0);
    // net = bruto − potongan (deterministik)
    const bruto = slip.earnings.baseSalary + slip.earnings.fixedAllowance;
    const potongan = slip.deductions.bpjsKetenagakerjaan + slip.deductions.pph21;
    expect(slip.netSalary).toBe(bruto - potongan);
  });

  // ---------- Alur 3: LMS → sertifikat ----------
  it('LMS: kursus → enroll → selesai → sertifikat otomatis terbit', async () => {
    const { listCourses, enrollLocal, completeCourse } = await import('@/lib/services/learningLmsService');
    const { issueCertificate, verifyCertificate } = await import('@/lib/services/certificateService');

    const courses = await listCourses(db);
    expect(courses.length).toBeGreaterThan(0);
    const course = courses[0];

    await enrollLocal(db, BUDI, course.id);
    await completeCourse(db, BUDI, course.id);

    // Terbitkan (idempoten) lalu verifikasi publik
    const cert = await issueCertificate(db, BUDI, course.id);
    expect(cert.certificateNo).toBeTruthy();
    expect(cert.verificationCode).toBeTruthy();

    const verified = await verifyCertificate(db, cert.verificationCode);
    expect(verified.valid).toBe(true);
    expect(verified.certificate?.employeeName).toBeTruthy();
  });

  // ---------- Alur 4: profil (self-service) tercatat audit ----------
  it('profil self-service tersimpan & terekam di audit_logs', async () => {
    const { updateMyProfile, getMyProfile } = await import('@/lib/services/employeeProfileService');
    const BUDI_USER = 'e0000000-0000-4000-8000-000000000004';

    const before = await db.execute<any>(`SELECT COUNT(*)::int AS n FROM audit_logs`);
    const n0 = (before as any).rows[0].n;

    await updateMyProfile(db, BUDI, { phone_number: '+62 812-0000-0000' }, BUDI_USER);

    const profile = await getMyProfile(db, BUDI);
    expect((profile as any).phoneNumber).toBe('+62 812-0000-0000');

    const after = await db.execute<any>(`SELECT COUNT(*)::int AS n FROM audit_logs`);
    expect((after as any).rows[0].n).toBeGreaterThan(n0);
  });
});
