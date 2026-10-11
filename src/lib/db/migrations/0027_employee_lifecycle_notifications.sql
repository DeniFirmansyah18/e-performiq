-- 0027: Notifikasi siklus hidup karyawan (Event lifecycle: HIRED, PROBATION, OFFBOARDING, SEVERANCE).
-- Notifikasi in-app per karyawan (bukan kandidat), terpisah dari candidate_notifications.

CREATE TABLE IF NOT EXISTS employee_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  event_type VARCHAR(60) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employee_notifications_employee
  ON employee_notifications (employee_id, created_at DESC);
