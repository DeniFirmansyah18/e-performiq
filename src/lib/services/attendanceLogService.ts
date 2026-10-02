/**
 * Attendance Log Service (WS-9) — absensi check-in/check-out dengan foto & lokasi,
 * timesheet harian (foto bukti, kategori), approval atasan, dan feed payroll.
 *
 * Tabel:
 *  - `attendance_logs`   : log check-in/out (baru, foto & geolokasi).
 *  - `attendance_records`: agregat harian (di-sinkron saat check-out) — dipakai payroll lama.
 *  - `daily_timesheets`  : kegiatan harian + foto + status approval.
 *
 * Catatan: file ini terpisah dari `attendanceService.ts` (yang menghitung Bradford
 * factor) agar keduanya koeksis. Deterministik, driver-agnostic, best-effort.
 */
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export interface GeoPoint {
  lat?: number | null;
  lng?: number | null;
}

export interface CheckInInput {
  employeeId: string;
  workDate?: string;
  photoUrl?: string | null;
  note?: string | null;
  geo?: GeoPoint;
}

export interface CheckOutInput {
  employeeId: string;
  workDate?: string;
  photoUrl?: string | null;
  note?: string | null;
  geo?: GeoPoint;
}

export interface AttendanceLogRow {
  id: string;
  employeeId: string;
  workDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInPhotoUrl: string | null;
  checkOutPhotoUrl: string | null;
  checkInLat: number | null;
  checkInLng: number | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  status: string;
  totalWorkHours: number | null;
  totalOvertimeHours: number | null;
}

const today = () => new Date().toISOString().slice(0, 10);

/** Hitung jam kerja & lembur dari total jam (asumsi 8 jam reguler). */
export function computeWorkAndOvertime(hours: number, regularHours = 8): { work: number; overtime: number } {
  const h = Math.max(0, Math.min(12, Math.round(hours * 100) / 100));
  const overtime = Math.max(0, Math.min(4, Math.round((h - regularHours) * 100) / 100));
  return { work: Math.round(h * 100) / 100, overtime };
}

/** Selisih jam desimal antara dua timestamp ISO (positif bila end > start). */
export function hoursBetween(startIso: string, endIso: string): number {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return ms > 0 ? ms / 3_600_000 : 0;
}

/** Check-in: buat log harian. Idempoten (tidak menimpa check-in yang sudah ada). */
export async function checkIn(db: Db, input: CheckInInput): Promise<AttendanceLogRow> {
  const workDate = input.workDate ?? today();
  await db.execute(sql`
    INSERT INTO attendance_logs
      (employee_id, work_date, check_in_at, check_in_lat, check_in_lng, check_in_photo_url, check_in_note, status)
    VALUES (${input.employeeId}::uuid, ${workDate}::date, CURRENT_TIMESTAMP,
            ${input.geo?.lat ?? null}, ${input.geo?.lng ?? null}, ${input.photoUrl ?? null},
            ${input.note ?? null}, 'OPEN')
    ON CONFLICT (employee_id, work_date) DO NOTHING
  `);
  return (await getLog(db, input.employeeId, workDate))!;
}

/** Check-out: isi jam keluar, hitung jam kerja/lembur, sinkron ke attendance_records. */
export async function checkOut(db: Db, input: CheckOutInput): Promise<AttendanceLogRow> {
  const workDate = input.workDate ?? today();
  const existing = await getLog(db, input.employeeId, workDate);
  if (!existing || !existing.checkInAt) {
    throw new Error('Belum ada check-in untuk hari ini. Lakukan check-in terlebih dahulu.');
  }
  if (existing.checkOutAt) {
    throw new Error('Anda sudah melakukan check-out hari ini.');
  }

  const nowIso = new Date().toISOString();
  const hours = hoursBetween(existing.checkInAt, nowIso);
  const { work, overtime } = computeWorkAndOvertime(hours);

  await db.execute(sql`
    UPDATE attendance_logs
       SET check_out_at = CURRENT_TIMESTAMP,
           check_out_lat = ${input.geo?.lat ?? null},
           check_out_lng = ${input.geo?.lng ?? null},
           check_out_photo_url = ${input.photoUrl ?? null},
           check_out_note = ${input.note ?? null},
           total_work_hours = ${work}, total_overtime_hours = ${overtime},
           status = 'CLOSED'
     WHERE employee_id = ${input.employeeId}::uuid AND work_date = ${workDate}::date
  `);

  await syncAttendanceRecord(db, input.employeeId, workDate, existing.checkInAt, nowIso, work, overtime);
  return (await getLog(db, input.employeeId, workDate))!;
}

/** Tulis/segarkan attendance_records dari log (kompatibel dengan payroll lama). */
async function syncAttendanceRecord(
  db: Db, employeeId: string, workDate: string, checkInIso: string, checkOutIso: string, work: number, overtime: number,
): Promise<void> {
  const checkIn = checkInIso.slice(11, 19);
  // Jamin check_out > check_in (constraint tabel) — tambah minimal 60 detik bila
  // check-in & check-out jatuh pada detik yang sama (mis. tes cepat).
  const ciMs = new Date(checkInIso).getTime();
  const coMs = Math.max(new Date(checkOutIso).getTime(), ciMs + 60_000);
  const checkOut = new Date(coMs).toISOString().slice(11, 19);
  try {
    await db.execute(sql`
      INSERT INTO attendance_records
        (employee_id, work_date, check_in, check_out, total_work_hours, total_overtime_hours, source)
      VALUES (${employeeId}::uuid, ${workDate}::date, ${checkIn}::time, ${checkOut}::time,
              ${Math.max(0.01, Math.min(12, work))}, ${overtime}, 'KIOSK')
      ON CONFLICT (employee_id, work_date)
      DO UPDATE SET check_in = EXCLUDED.check_in, check_out = EXCLUDED.check_out,
                    total_work_hours = EXCLUDED.total_work_hours,
                    total_overtime_hours = EXCLUDED.total_overtime_hours
    `);
  } catch (err) {
    console.warn('[attendanceLogService] sinkron attendance_records gagal:', (err as Error)?.message);
  }
}

/** Ambil satu log absensi. */
export async function getLog(db: Db, employeeId: string, workDate: string): Promise<AttendanceLogRow | null> {
  const res = (await db.execute(sql`
    SELECT id, employee_id AS "employeeId", work_date AS "workDate",
           check_in_at AS "checkInAt", check_out_at AS "checkOutAt",
           check_in_lat::float8 AS "checkInLat", check_in_lng::float8 AS "checkInLng",
           check_out_lat::float8 AS "checkOutLat", check_out_lng::float8 AS "checkOutLng",
           check_in_photo_url AS "checkInPhotoUrl", check_out_photo_url AS "checkOutPhotoUrl",
           status, total_work_hours::float8 AS "totalWorkHours", total_overtime_hours::float8 AS "totalOvertimeHours"
      FROM attendance_logs WHERE employee_id = ${employeeId}::uuid AND work_date = ${workDate}::date
  `)) as unknown as { rows: AttendanceLogRow[] };
  return res.rows?.[0] ?? null;
}

/** Daftar log absensi karyawan (default 30 terbaru). */
export async function listLogs(db: Db, employeeId: string, limit = 30): Promise<AttendanceLogRow[]> {
  const res = (await db.execute(sql`
    SELECT id, employee_id AS "employeeId", work_date AS "workDate",
           check_in_at AS "checkInAt", check_out_at AS "checkOutAt",
           check_in_photo_url AS "checkInPhotoUrl", check_out_photo_url AS "checkOutPhotoUrl",
           check_in_lat::float8 AS "checkInLat", check_in_lng::float8 AS "checkInLng",
           status, total_work_hours::float8 AS "totalWorkHours", total_overtime_hours::float8 AS "totalOvertimeHours"
      FROM attendance_logs WHERE employee_id = ${employeeId}::uuid
     ORDER BY work_date DESC LIMIT ${limit}
  `)) as unknown as { rows: AttendanceLogRow[] };
  return res.rows ?? [];
}

// ---------------------------------------------------------------------------
// Timesheet harian (foto + kategori + approval)
// ---------------------------------------------------------------------------

export interface TimesheetInput {
  employeeId: string;
  workDate: string;
  regularHours?: number;
  overtimeHours?: number;
  taskSummary: string;
  activityCategory?: string;
  location?: string;
  photos?: string[];
}

export interface TimesheetRow {
  id: string;
  employeeId: string;
  workDate: string;
  regularHours: number;
  overtimeHours: number;
  taskSummary: string;
  activityCategory: string | null;
  location: string | null;
  photos: string[];
  approvalStatus: string;
  rejectionNote: string | null;
  approvedAt: string | null;
}

function parsePhotos(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[];
  if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

function normalizeTimesheet(r: any): TimesheetRow {
  return {
    id: r.id,
    employeeId: r.employeeId,
    workDate: typeof r.workDate === 'string' ? r.workDate.slice(0, 10) : r.workDate,
    regularHours: Number(r.regularHours),
    overtimeHours: Number(r.overtimeHours),
    taskSummary: r.taskSummary,
    activityCategory: r.activityCategory ?? null,
    location: r.location ?? null,
    photos: parsePhotos(r.photos),
    approvalStatus: r.approvalStatus,
    rejectionNote: r.rejectionNote ?? null,
    approvedAt: r.approvedAt ?? null,
  };
}

/** Submit/segarkan timesheet harian (status SUBMITTED, menunggu approval atasan). */
export async function submitTimesheet(db: Db, input: TimesheetInput): Promise<TimesheetRow> {
  const regularHours = input.regularHours ?? 8;
  const overtimeHours = input.overtimeHours ?? 0;
  if (overtimeHours < 0 || overtimeHours > 4) {
    throw new Error('Waktu lembur melanggar batas PP No. 35/2021 (maks 4 jam/hari).');
  }
  const photos = JSON.stringify(input.photos ?? []);
  const res = (await db.execute(sql`
    INSERT INTO daily_timesheets
      (employee_id, work_date, regular_hours, overtime_hours, task_summary, activity_category, location, photos,
       approval_status, submitted_at)
    VALUES (${input.employeeId}::uuid, ${input.workDate}::date, ${regularHours}, ${overtimeHours},
            ${input.taskSummary}, ${input.activityCategory ?? 'GENERAL'}, ${input.location ?? null},
            ${photos}::jsonb, 'SUBMITTED', CURRENT_TIMESTAMP)
    ON CONFLICT (employee_id, work_date)
    DO UPDATE SET regular_hours = EXCLUDED.regular_hours, overtime_hours = EXCLUDED.overtime_hours,
                  task_summary = EXCLUDED.task_summary, activity_category = EXCLUDED.activity_category,
                  location = EXCLUDED.location, photos = EXCLUDED.photos,
                  approval_status = 'SUBMITTED', submitted_at = CURRENT_TIMESTAMP, rejection_note = NULL
    RETURNING id, employee_id AS "employeeId", work_date AS "workDate",
              regular_hours::float8 AS "regularHours", overtime_hours::float8 AS "overtimeHours",
              task_summary AS "taskSummary", activity_category AS "activityCategory", location, photos,
              approval_status AS "approvalStatus", rejection_note AS "rejectionNote", approved_at AS "approvedAt"
  `)) as unknown as { rows: any[] };
  return normalizeTimesheet(res.rows[0]);
}

/** Daftar timesheet karyawan (default 30 terbaru). */
export async function listTimesheets(db: Db, employeeId: string, limit = 30): Promise<TimesheetRow[]> {
  const res = (await db.execute(sql`
    SELECT id, employee_id AS "employeeId", work_date AS "workDate",
           regular_hours::float8 AS "regularHours", overtime_hours::float8 AS "overtimeHours",
           task_summary AS "taskSummary", activity_category AS "activityCategory", location, photos,
           approval_status AS "approvalStatus", rejection_note AS "rejectionNote", approved_at AS "approvedAt"
      FROM daily_timesheets WHERE employee_id = ${employeeId}::uuid
     ORDER BY work_date DESC LIMIT ${limit}
  `)) as unknown as { rows: any[] };
  return (res.rows ?? []).map(normalizeTimesheet);
}

/** Timesheet yang menunggu approval untuk tim seorang atasan. */
export async function listPendingTimesheets(db: Db, managerEmployeeId: string): Promise<any[]> {
  const res = (await db.execute(sql`
    SELECT dt.id, dt.employee_id AS "employeeId", e.full_name AS "employeeName",
           dt.work_date AS "workDate", dt.regular_hours::float8 AS "regularHours",
           dt.overtime_hours::float8 AS "overtimeHours", dt.task_summary AS "taskSummary",
           dt.activity_category AS "activityCategory", dt.location, dt.photos,
           dt.approval_status AS "approvalStatus", dt.submitted_at AS "submittedAt"
      FROM daily_timesheets dt
      JOIN employees e ON e.id = dt.employee_id
     WHERE e.manager_id = ${managerEmployeeId}::uuid AND dt.approval_status = 'SUBMITTED'
     ORDER BY dt.work_date DESC
  `)) as unknown as { rows: any[] };
  return (res.rows ?? []).map((r) => ({ ...r, photos: parsePhotos(r.photos) }));
}

/** Approve/reject timesheet oleh atasan. */
export async function decideTimesheet(
  db: Db,
  payload: { timesheetId: string; approverUserId: string; decision: 'APPROVED' | 'REJECTED'; note?: string },
): Promise<TimesheetRow | null> {
  const res = (await db.execute(sql`
    UPDATE daily_timesheets
       SET approval_status = ${payload.decision}, approved_by = ${payload.approverUserId}::uuid,
           approved_at = CURRENT_TIMESTAMP, rejection_note = ${payload.note ?? null}
     WHERE id = ${payload.timesheetId}::uuid
     RETURNING id, employee_id AS "employeeId", work_date AS "workDate",
               regular_hours::float8 AS "regularHours", overtime_hours::float8 AS "overtimeHours",
               task_summary AS "taskSummary", activity_category AS "activityCategory", location, photos,
               approval_status AS "approvalStatus", rejection_note AS "rejectionNote", approved_at AS "approvedAt"
  `)) as unknown as { rows: any[] };
  return res.rows[0] ? normalizeTimesheet(res.rows[0]) : null;
}

/**
 * Agregat absensi untuk payroll: total jam reguler & lembur (dari attendance_records)
 * serta jumlah timesheet ter-approve dalam sebuah periode. Dipakai WS-10.
 */
export async function getAttendanceSummary(
  db: Db,
  employeeId: string,
  periodStart: string,
  periodEnd: string,
): Promise<{ regularHours: number; overtimeHours: number; presentDays: number; approvedTimesheets: number }> {
  const att = (await db.execute(sql`
    SELECT COALESCE(SUM(total_work_hours),0)::float8 AS "regular",
           COALESCE(SUM(total_overtime_hours),0)::float8 AS "overtime",
           COUNT(*) FILTER (WHERE is_present = TRUE)::int AS "presentDays"
      FROM attendance_records
     WHERE employee_id = ${employeeId}::uuid
       AND work_date BETWEEN ${periodStart}::date AND ${periodEnd}::date
  `)) as unknown as { rows: Array<{ regular: number; overtime: number; presentDays: number }> };
  const ts = (await db.execute(sql`
    SELECT COUNT(*)::int AS "approved" FROM daily_timesheets
     WHERE employee_id = ${employeeId}::uuid
       AND work_date BETWEEN ${periodStart}::date AND ${periodEnd}::date
       AND approval_status = 'APPROVED'
  `)) as unknown as { rows: Array<{ approved: number }> };
  return {
    regularHours: Number(att.rows?.[0]?.regular ?? 0),
    overtimeHours: Number(att.rows?.[0]?.overtime ?? 0),
    presentDays: Number(att.rows?.[0]?.presentDays ?? 0),
    approvedTimesheets: Number(ts.rows?.[0]?.approved ?? 0),
  };
}
