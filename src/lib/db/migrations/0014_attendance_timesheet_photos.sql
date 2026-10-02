-- 0014: Absensi & timesheet dengan foto bukti + lokasi (WS-9) + approval atasan.
-- Idempotent (ADR 003). Selaras spec: docs/superpowers/specs/2026-10-02-rekrutmen-lms-payroll-design.md §4 (C1).

-- ============================================================
-- C1a. Log absensi (check-in / check-out) dengan foto & lokasi
-- ------------------------------------------------------------
-- Tabel BARU (bukan mengubah attendance_records) agar agregat harian &
-- query payroll lama tetap utuh. attendance_records tetap diisi setelah
-- check-out (sinkron) untuk kompatibilitas.
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  check_in_lat NUMERIC(9,6),
  check_in_lng NUMERIC(9,6),
  check_out_lat NUMERIC(9,6),
  check_out_lng NUMERIC(9,6),
  check_in_photo_url TEXT,
  check_out_photo_url TEXT,
  check_in_note TEXT,
  check_out_note TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','CLOSED','MISSING_CHECKOUT','APPROVED','REJECTED')),
  total_work_hours DECIMAL(4,2),
  total_overtime_hours DECIMAL(4,2) DEFAULT 0.00,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, work_date)
);

-- ============================================================
-- C1b. Timesheet: foto bukti, kategori kegiatan, lokasi, approval
-- ============================================================
ALTER TABLE daily_timesheets ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE daily_timesheets ADD COLUMN IF NOT EXISTS activity_category VARCHAR(50) DEFAULT 'GENERAL';
ALTER TABLE daily_timesheets ADD COLUMN IF NOT EXISTS location VARCHAR(200);
ALTER TABLE daily_timesheets ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE daily_timesheets ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE daily_timesheets ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE daily_timesheets ADD COLUMN IF NOT EXISTS rejection_note TEXT;
