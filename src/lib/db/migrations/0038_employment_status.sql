-- 0038: Status kepegawaian + riwayat (PRD v2.0 §10.3 A).
-- Aditif: kolom baru punya default sehingga data berjalan tetap valid.
CREATE TYPE employment_status_enum AS ENUM
  ('PROBATION', 'PKWT', 'PKWTT', 'TETAP', 'RESIGNED', 'RETIRED');

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS employment_status employment_status_enum NOT NULL DEFAULT 'PROBATION',
  ADD COLUMN IF NOT EXISTS appointment_date DATE;

CREATE TABLE IF NOT EXISTS employment_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  previous_status employment_status_enum,
  new_status employment_status_enum NOT NULL,
  effective_date DATE NOT NULL,
  reason TEXT,
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CHECK (previous_status IS DISTINCT FROM new_status)
);

CREATE INDEX IF NOT EXISTS idx_employment_history_employee
  ON employment_status_history (employee_id, effective_date DESC);
