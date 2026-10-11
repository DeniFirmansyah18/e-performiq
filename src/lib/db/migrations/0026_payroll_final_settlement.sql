-- 0026: Final settlement (pesangon/DPLK) sebagai run payroll khusus offboarding.
-- Menghubungkan offboarding (severance_calculations) ke payroll agar slip gaji mencakup
-- uang pesangon + DPLK saat karyawan keluar. Idempotent (ADR 003).

-- Jenis run: REGULAR (bulanan) atau FINAL_SETTLEMENT (pesangon saat keluar).
DO $$ BEGIN CREATE TYPE payroll_run_type_enum AS ENUM ('REGULAR','FINAL_SETTLEMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE payroll_runs
  ADD COLUMN IF NOT EXISTS run_type payroll_run_type_enum NOT NULL DEFAULT 'REGULAR',
  ADD COLUMN IF NOT EXISTS offboarding_request_id UUID REFERENCES offboarding_requests(id) ON DELETE SET NULL;

-- Komponen pesangon pada item (default 0 → run reguler tidak terpengaruh).
ALTER TABLE payroll_items
  ADD COLUMN IF NOT EXISTS severance NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dplk_topup NUMERIC(15,2) NOT NULL DEFAULT 0;

-- Run final settlement tidak boleh dobel untuk 1 offboarding request.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_runs_final_settlement
  ON payroll_runs (offboarding_request_id)
  WHERE run_type = 'FINAL_SETTLEMENT' AND offboarding_request_id IS NOT NULL;
