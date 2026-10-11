-- 0033: Registry usulan perbaikan / Kaizen (PRD §3.2 sub-matriks: min 1/semester).
-- Idempotent (ADR 003).

CREATE TABLE IF NOT EXISTS improvement_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  period_id UUID REFERENCES appraisal_periods(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  estimated_saving_idr DECIMAL(18,2) CHECK (estimated_saving_idr >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('SUBMITTED','APPROVED','REJECTED','IMPLEMENTED')),
  reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewer_notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  decided_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_improvement_ideas_emp ON improvement_ideas(employee_id, period_id);
