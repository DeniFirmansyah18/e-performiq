-- 0043: Pengajuan lembur (PRD v2.0 §5.6, §10.3 D).
DO $$ BEGIN CREATE TYPE overtime_status_enum AS ENUM
  ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS overtime_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  planned_hours DECIMAL(4,2) NOT NULL CHECK (planned_hours > 0 AND planned_hours <= 4),
  reason TEXT NOT NULL,
  status overtime_status_enum NOT NULL DEFAULT 'DRAFT',
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_overtime_pending
  ON overtime_requests (status, work_date) WHERE status = 'SUBMITTED';
