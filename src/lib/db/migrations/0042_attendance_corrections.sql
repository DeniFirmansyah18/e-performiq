-- 0042: Mode kerja & koreksi absensi (PRD v2.0 §5.5, §10.3 H).
CREATE TYPE work_mode_enum AS ENUM ('WFO', 'WFH', 'FIELD_DUTY');
CREATE TYPE correction_status_enum AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');

ALTER TABLE attendance_logs
  ADD COLUMN IF NOT EXISTS work_mode work_mode_enum NOT NULL DEFAULT 'WFO';

CREATE TABLE IF NOT EXISTS attendance_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_log_id UUID NOT NULL REFERENCES attendance_logs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  requested_check_in_at TIMESTAMPTZ,
  requested_check_out_at TIMESTAMPTZ,
  reason TEXT NOT NULL,
  status correction_status_enum NOT NULL DEFAULT 'SUBMITTED',
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CHECK (requested_check_in_at IS NOT NULL OR requested_check_out_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_attendance_corrections_pending
  ON attendance_corrections (status, created_at) WHERE status = 'SUBMITTED';
