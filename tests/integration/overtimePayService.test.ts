import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { listPayableOvertime } from '@/lib/services/overtimePayService';

describe('overtimePayService — hanya lembur disetujui yang dibayar', () => {
  let client: PGlite;
  let db: any;
  let employeeId = '';
  const approver = 'e0000000-0000-4000-8000-000000000002';

  const addRequest = async (
    workDate: string, plannedHours: number, status: 'SUBMITTED' | 'APPROVED' | 'REJECTED',
  ) => {
    await db.execute(`
      INSERT INTO overtime_requests (employee_id, work_date, planned_hours, reason, status, approved_by)
      VALUES ('${employeeId}', '${workDate}', ${plannedHours}, 'penyelesaian laporan', '${status}',
              ${status === 'APPROVED' ? `'${approver}'` : 'NULL'}::uuid)`);
  };

  const addAttendance = async (workDate: string, overtimeHours: number) => {
    await db.execute(`
      INSERT INTO attendance_logs (employee_id, work_date, check_in_at, total_overtime_hours)
      VALUES ('${employeeId}', '${workDate}', '${workDate}T08:00:00+07:00', ${overtimeHours})`);
  };

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);

    const stamp = Date.now();
    const emp = (await db.execute(`
      INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
      VALUES (gen_random_uuid(), 'OTP-${stamp}', 'Lembur Payroll Uji', 'otp.${stamp}@eperformiq.co.id',
              'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
              'PERMANENT', 10000000, CURRENT_DATE)
      RETURNING id`)) as unknown as { rows: Array<{ id: string }> };
    employeeId = emp.rows[0].id;

    // 2026-10-05 Senin (hari kerja), 2026-10-04 Minggu (hari libur), 2026-10-07 Rabu.
    await addRequest('2026-10-05', 3, 'APPROVED');
    await addAttendance('2026-10-05', 2);          // aktual < disetujui → bayar 2

    await addRequest('2026-10-07', 1.5, 'SUBMITTED'); // belum disetujui → 0
    await addAttendance('2026-10-07', 1.5);

    await addRequest('2026-10-04', 8, 'APPROVED');   // hari libur, tanpa absensi → pakai 8
  });
  afterAll(async () => { await client.close(); });

  it('lembur tanpa persetujuan tidak dibayar', async () => {
    const res = await listPayableOvertime(db, employeeId, '2026-10-01', '2026-10-31');
    // Pengajuan SUBMITTED tidak masuk hasil sama sekali — bukan dibayar 0.
    expect(res.days.find((d) => d.date === '2026-10-07')).toBeUndefined();
    expect(res.days.every((d) => d.payableHours >= 0)).toBe(true);
  });

  it('jam dibayar = min(disetujui, aktual) bila ada absensi', async () => {
    const res = await listPayableOvertime(db, employeeId, '2026-10-01', '2026-10-31');
    const day = res.days.find((d) => d.date === '2026-10-05');
    expect(day?.approvedHours).toBe(3);
    expect(day?.clockedHours).toBe(2);
    expect(day?.payableHours).toBe(2);
  });

  it('tanpa absensi sama sekali → pakai jam disetujui', async () => {
    const res = await listPayableOvertime(db, employeeId, '2026-10-01', '2026-10-31');
    const day = res.days.find((d) => d.date === '2026-10-04');
    expect(day?.clockedHours).toBeNull();
    expect(day?.payableHours).toBe(8);
  });

  it('hari Minggu diklasifikasikan sebagai hari libur', async () => {
    const res = await listPayableOvertime(db, employeeId, '2026-10-01', '2026-10-31');
    expect(res.days.find((d) => d.date === '2026-10-04')?.dayType).toBe('REST_DAY');
    expect(res.days.find((d) => d.date === '2026-10-05')?.dayType).toBe('WORKDAY');
  });

  it('hari libur nasional dari company_holidays ikut dihitung REST_DAY', async () => {
    await db.execute(`INSERT INTO company_holidays (holiday_date, name) VALUES ('2026-10-06', 'Cuti bersama')`);
    await addRequest('2026-10-06', 2, 'APPROVED');

    const res = await listPayableOvertime(db, employeeId, '2026-10-01', '2026-10-31');
    expect(res.days.find((d) => d.date === '2026-10-06')?.dayType).toBe('REST_DAY');
  });

  it('total jam dipisah per jenis hari', async () => {
    const res = await listPayableOvertime(db, employeeId, '2026-10-01', '2026-10-31');
    // 2026-10-05 = 2 (kerja), 2026-10-06 = 2 (libur), 2026-10-04 = 8 (libur)
    expect(res.workdayHours).toBe(2);
    expect(res.restDayHours).toBe(10);
    expect(res.totalHours).toBe(12);
  });

  it('rentang tanggal membatasi hasil', async () => {
    const res = await listPayableOvertime(db, employeeId, '2026-10-01', '2026-10-05');
    expect(res.days.every((d) => d.date <= '2026-10-05')).toBe(true);
    // 2026-10-04 (Minggu, 8 jam) + 2026-10-05 (2 jam) = 10.
    expect(res.totalHours).toBe(10);
    expect(res.days.find((d) => d.date === '2026-10-06')).toBeUndefined();
  });
});
