import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { getMyProfile, updateMyProfile, getMyLifecycleProfile, tenureParts } from '@/lib/services/employeeProfileService';
import type { Db } from '@/lib/db/client';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const HR_USER = 'e0000000-0000-4000-8000-000000000002';

describe('employeeProfileService', () => {
  let client: PGlite; let db: Db;
  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  });
  afterAll(async () => { await client.close(); });

  it('getMyProfile mengembalikan data dasar', async () => {
    const p = await getMyProfile(db, BUDI);
    expect(p.fullName).toBeTruthy();
    expect(p.employeeCode).toBeTruthy();
  });

  it('updateMyProfile hanya mengubah field yang diizinkan (sensitif diabaikan)', async () => {
    await updateMyProfile(db, BUDI, { phone_number: '+62 812-9999-0000', base_salary: 1 } as any, HR_USER);
    const p = await getMyProfile(db, BUDI);
    expect(p.phoneNumber).toBe('+62 812-9999-0000');
    expect(Number(p.baseSalary)).not.toBe(1);
  });

  it('menulis satu baris audit_logs untuk perubahan profil', async () => {
    const before = await client.query<{ c: string }>(`SELECT count(*)::text AS c FROM audit_logs`);
    await updateMyProfile(db, BUDI, { bio: 'Update bio test' }, HR_USER);
    const after = await client.query<{ c: string }>(`SELECT count(*)::text AS c FROM audit_logs`);
    expect(Number(after.rows[0].c)).toBe(Number(before.rows[0].c) + 1);
    const row = await client.query<{ entity_name: string; record_id: string }>(
      `SELECT entity_name, record_id FROM audit_logs ORDER BY created_at DESC LIMIT 1`);
    expect(row.rows[0].entity_name).toBe('employees');
    expect(row.rows[0].record_id).toBe(BUDI);
  });

  it('getMyLifecycleProfile mengembalikan identitas, atasan, unit, dan jabatan akun login', async () => {
    const p = await getMyLifecycleProfile(db, BUDI);
    expect(p).not.toBeNull();
    expect(p.fullName).toBe('Budi Pratama');
    expect(p.employeeCode).toBe('EMP-2022-0042');
    expect(p.departmentName).toBeTruthy();
    expect(p.positionTitle).toBeTruthy();
    expect(p.managerName).toBe('Raden Mas Danu, S.T., M.Kom.');
    expect(p.status).toBe('PERMANENT');
    expect(p.statusLabel).toBe('Tetap (Permanent)');
  });

  it('getMyLifecycleProfile menurunkan masa bakti dari join_date', async () => {
    const p = await getMyLifecycleProfile(db, BUDI);
    expect(p.joinDate).toBeTruthy();
    expect(p.tenure).toBeTruthy();
    expect(typeof p.tenure.label).toBe('string');
    expect(p.tenure.label).not.toBe('—');
  });

  it('getMyLifecycleProfile memuat kinerja (GPA) & fase karyawan tetap', async () => {
    const p = await getMyLifecycleProfile(db, BUDI);
    expect(p.performance.gpa).toBeCloseTo(3.67, 1);
    // Karyawan tetap tanpa offboarding = fase Saat Kerja.
    expect(p.phase).toBe('DURING');
    expect(p.offboardingStatus).toBeNull();
  });

  it('getMyLifecycleProfile menandai fase POST saat ada offboarding', async () => {
    const OFF_EMP = 'b0000000-0000-4000-8000-000000000008';
    await client.exec(`
      INSERT INTO offboarding_requests (employee_id, reason_for_leaving, resignation_notice_date, last_working_day, status)
      VALUES ('${OFF_EMP}','RESIGNATION','2026-09-01','2026-09-30','INITIATED');
    `);
    const p = await getMyLifecycleProfile(db, OFF_EMP);
    expect(p.phase).toBe('POST');
    expect(p.offboardingStatus).toBe('INITIATED');
  });

  it('getMyLifecycleProfile menandai fase PRE untuk karyawan dengan program onboarding berjalan', async () => {
    const PRE_EMP = 'b0000000-0000-4000-8000-000000000011';
    await client.exec(`
      UPDATE employees SET status='PROBATION' WHERE id='${PRE_EMP}';
      INSERT INTO onboarding_programs (employee_id, status) VALUES ('${PRE_EMP}','IN_PROGRESS');
      INSERT INTO onboarding_milestones (employee_id, probation_passed) VALUES ('${PRE_EMP}', FALSE);
    `);
    const p = await getMyLifecycleProfile(db, PRE_EMP);
    expect(p.phase).toBe('PRE');
    expect(p.onboarding.probationPassed).toBe(false);
  });

  it('getMyLifecycleProfile membaca program onboarding tanpa baris milestone (anchor program)', async () => {
    const NO_MILESTONE_EMP = 'b0000000-0000-4000-8000-000000000009';
    await client.exec(`
      DELETE FROM onboarding_milestones WHERE employee_id='${NO_MILESTONE_EMP}';
      DELETE FROM onboarding_programs WHERE employee_id='${NO_MILESTONE_EMP}';
      UPDATE employees SET status='PROBATION' WHERE id='${NO_MILESTONE_EMP}';
      INSERT INTO onboarding_programs (employee_id, status) VALUES ('${NO_MILESTONE_EMP}','IN_PROGRESS');
    `);
    const p = await getMyLifecycleProfile(db, NO_MILESTONE_EMP);
    // Program terbaca walau belum ada milestone → bukan "belum ada orientasi".
    expect(p.onboarding.programStatus).toBe('IN_PROGRESS');
    expect(p.phase).toBe('PRE');
  });

  it('getMyLifecycleProfile menaikkan PROBATION yang orientasinya tuntas ke fase DURING', async () => {
    const DONE_EMP = 'b0000000-0000-4000-8000-000000000011';
    await client.exec(`
      DELETE FROM onboarding_milestones WHERE employee_id='${DONE_EMP}';
      DELETE FROM onboarding_programs WHERE employee_id='${DONE_EMP}';
      UPDATE employees SET status='PROBATION' WHERE id='${DONE_EMP}';
      INSERT INTO onboarding_programs (employee_id, status) VALUES ('${DONE_EMP}','COMPLETED');
    `);
    const p = await getMyLifecycleProfile(db, DONE_EMP);
    expect(p.phase).toBe('DURING');
    expect(p.onboarding.programStatus).toBe('COMPLETED');
  });

  it('tenureParts menghitung tahun & bulan, dan aman untuk tanggal kosong', () => {
    const ref = new Date('2026-07-01T00:00:00Z');
    const t = tenureParts('2022-03-15', ref);
    expect(t.years).toBe(4);
    expect(t.months).toBe(3);
    expect(t.label).toBe('4 Thn 3 Bln');
    expect(tenureParts(null).label).toBe('—');
    expect(tenureParts('bukan-tanggal').label).toBe('—');
  });
});
