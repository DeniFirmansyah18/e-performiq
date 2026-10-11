-- 0032: Metrik kepatuhan SOP & SLA terstruktur per periode (DUR-02, bobot 20%).
-- Idempotent (ADR 003). Keputusan produk D1: input manual HR/manager.
-- Tabel BARU agar sop_compliance_logs lama (dipakai VMAI) tetap utuh.

CREATE TABLE IF NOT EXISTS sop_period_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES appraisal_periods(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  total_assigned_tasks INT NOT NULL DEFAULT 0 CHECK (total_assigned_tasks >= 0),
  tasks_on_time INT NOT NULL DEFAULT 0 CHECK (tasks_on_time >= 0),
  error_count INT NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  fatal_error_count INT NOT NULL DEFAULT 0 CHECK (fatal_error_count >= 0),
  audit_findings_count INT NOT NULL DEFAULT 0 CHECK (audit_findings_count >= 0),
  notes TEXT,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (period_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_sop_period_metrics_emp ON sop_period_metrics(employee_id, period_id);
