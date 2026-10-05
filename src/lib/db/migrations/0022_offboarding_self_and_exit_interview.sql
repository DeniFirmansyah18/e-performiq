-- ============================================================
-- 0022. Offboarding self-service + exit interview
--  - Kolom `notes` pada knowledge_handovers (karyawan menandai item siap).
--  - Tabel `exit_interviews` (umpan balik karyawan yang keluar).
-- Aditif & idempoten.
-- ============================================================

ALTER TABLE knowledge_handovers ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE TABLE IF NOT EXISTS exit_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  offboarding_request_id UUID REFERENCES offboarding_requests(id) ON DELETE SET NULL,
  feedback TEXT NOT NULL,
  overall_rating INT CHECK (overall_rating BETWEEN 1 AND 5),
  would_recommend BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, offboarding_request_id)
);

CREATE INDEX IF NOT EXISTS idx_exit_interviews_employee ON exit_interviews(employee_id);
