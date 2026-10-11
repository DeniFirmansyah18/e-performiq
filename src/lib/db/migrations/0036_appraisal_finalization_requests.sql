-- 0036: Pengajuan finalisasi penilaian kinerja (self-appraisal) per periode.
-- Karyawan mengajukan finalisasi ke atasan; atasan menyetujui/menolak.
CREATE TABLE IF NOT EXISTS appraisal_finalization_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES appraisal_periods(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  note TEXT,
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (period_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_finalization_requests_emp_period
  ON appraisal_finalization_requests (employee_id, period_id);
CREATE INDEX IF NOT EXISTS idx_finalization_requests_status
  ON appraisal_finalization_requests (status);
