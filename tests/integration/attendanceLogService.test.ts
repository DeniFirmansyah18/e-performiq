import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import {
  checkIn,
  checkOut,
  getLog,
  listLogs,
  submitTimesheet,
  listTimesheets,
  listPendingTimesheets,
  decideTimesheet,
  getAttendanceSummary,
  computeWorkAndOvertime,
  hoursBetween,
} from '@/lib/services/attendanceLogService';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const BUDI_USER = 'e0000000-0000-4000-8000-000000000004';

describe('WS-9 absensi & timesheet (foto)', () => {
  let client: PGlite;
  let db: any;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
  });
  afterAll(async () => { await client.close(); });

  describe('fungsi murni', () => {
    it('computeWorkAndOvertime membatasi lembur maks 4 jam', () => {
      expect(computeWorkAndOvertime(9).overtime).toBe(1);
      expect(computeWorkAndOvertime(8).overtime).toBe(0);
      expect(computeWorkAndOvertime(14).overtime).toBe(4); // cap
      expect(computeWorkAndOvertime(20).work).toBe(12);     // cap
    });

    it('hoursBetween mengembalikan jam desimal & 0 bila negatif', () => {
      const h = hoursBetween('2026-10-02T08:00:00Z', '2026-10-02T17:30:00Z');
      expect(h).toBeCloseTo(9.5, 2);
      expect(hoursBetween('2026-10-02T17:00:00Z', '2026-10-02T08:00:00Z')).toBe(0);
    });
  });

  describe('check-in / check-out (DB)', () => {
    const workDate = '2030-01-15'; // tanggal jauh agar tidak bentrok seed

    it('check-in membuat log OPEN dengan foto & lokasi', async () => {
      const row = await checkIn(db, {
        employeeId: BUDI, workDate,
        photoUrl: 'data:image/jpeg;base64,AAAA', note: 'Datang tepat waktu',
        geo: { lat: -6.2, lng: 106.8 },
      });
      expect(row.status).toBe('OPEN');
      expect(row.checkInAt).toBeTruthy();
      expect(row.checkInPhotoUrl).toContain('data:image');
      expect(row.checkInLat).toBeCloseTo(-6.2, 3);
    });

    it('check-in idempoten (tidak menimpa)', async () => {
      const before = await getLog(db, BUDI, workDate);
      await checkIn(db, { employeeId: BUDI, workDate, note: 'kedua' });
      const after = await getLog(db, BUDI, workDate);
      expect(after!.checkInAt).toBe(before!.checkInAt);
    });

    it('check-out menutup log, menghitung jam & sinkron ke attendance_records', async () => {
      const row = await checkOut(db, {
        employeeId: BUDI, workDate, photoUrl: 'data:image/jpeg;base64,BBBB', geo: { lat: -6.2, lng: 106.8 },
      });
      expect(row.status).toBe('CLOSED');
      expect(row.checkOutAt).toBeTruthy();
      expect(row.totalWorkHours).not.toBeNull();

      const rec = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM attendance_records WHERE employee_id = $1::uuid AND work_date = $2::date`,
        [BUDI, workDate],
      );
      expect(Number(rec.rows[0].n)).toBe(1);
    });

    it('check-out kedua ditolak', async () => {
      await expect(checkOut(db, { employeeId: BUDI, workDate })).rejects.toThrow(/check-out/i);
    });

    it('check-out tanpa check-in ditolak', async () => {
      await expect(checkOut(db, { employeeId: BUDI, workDate: '2030-02-20' })).rejects.toThrow(/check-in/i);
    });

    it('listLogs mengembalikan log terbaru', async () => {
      const logs = await listLogs(db, BUDI, 10);
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[0].workDate.slice(0, 10)).toBe(workDate);
    });
  });

  describe('timesheet & approval (DB)', () => {
    const workDate = '2030-01-16';

    it('submitTimesheet dengan foto tersimpan status SUBMITTED', async () => {
      const row = await submitTimesheet(db, {
        employeeId: BUDI, workDate, regularHours: 8, overtimeHours: 1.5,
        taskSummary: 'Migrasi modul payroll & review PR',
        activityCategory: 'PROJECT', location: 'Kantor Jakarta',
        photos: ['data:image/jpeg;base64,AAAA', 'data:image/jpeg;base64,BBBB'],
      });
      expect(row.approvalStatus).toBe('SUBMITTED');
      expect(row.overtimeHours).toBe(1.5);
      expect(row.photos.length).toBe(2);
      expect(row.activityCategory).toBe('PROJECT');
    });

    it('lembur > 4 jam ditolak', async () => {
      await expect(submitTimesheet(db, { employeeId: BUDI, workDate, overtimeHours: 5, taskSummary: 'x' }))
        .rejects.toThrow(/lembur/i);
    });

    it('atasan melihat timesheet tim yang menunggu approval', async () => {
      // Budi manager = b0000000-...000003 (Danu). Cek daftar pending untuk manager tsb.
      const mgr = await client.query<{ id: string }>(
        `SELECT manager_id AS id FROM employees WHERE id = $1::uuid`, [BUDI],
      );
      const rows = await listPendingTimesheets(db, mgr.rows[0].id);
      expect(rows.some((r: any) => r.workDate.slice(0, 10) === workDate)).toBe(true);
      const row = rows.find((r: any) => r.workDate.slice(0, 10) === workDate);
      expect(Array.isArray(row.photos)).toBe(true);
      expect(row.photos.length).toBe(2);
    });

    it('atasan menyetujui timesheet → APPROVED', async () => {
      const ts = await listTimesheets(db, BUDI, 10);
      const target = ts.find((t) => t.workDate === workDate)!;
      const row = await decideTimesheet(db, { timesheetId: target.id, approverUserId: BUDI_USER, decision: 'APPROVED' });
      expect(row!.approvalStatus).toBe('APPROVED');
      expect(row!.approvedAt).toBeTruthy();
    });

    it('menolak timesheet menyimpan catatan', async () => {
      const ts2 = await submitTimesheet(db, { employeeId: BUDI, workDate: '2030-01-17', taskSummary: 'tugas' });
      const row = await decideTimesheet(db, { timesheetId: ts2.id, approverUserId: BUDI_USER, decision: 'REJECTED', note: 'Kurang detail' });
      expect(row!.approvalStatus).toBe('REJECTED');
      expect(row!.rejectionNote).toBe('Kurang detail');
    });

    it('getAttendanceSummary menghitung jam & timesheet approve (feed payroll)', async () => {
      const summary = await getAttendanceSummary(db, BUDI, '2030-01-01', '2030-01-31');
      expect(summary.regularHours).toBeGreaterThan(0);
      expect(summary.overtimeHours).toBeGreaterThanOrEqual(0);
      expect(summary.presentDays).toBeGreaterThanOrEqual(1);
      expect(summary.approvedTimesheets).toBeGreaterThanOrEqual(1);
    });
  });
});
