-- 0028: Batch job queue untuk kalkulasi GPA massal (PRD §6.1).
-- Kalkulasi GPA per-karyawan-per-periode berat bila dijalankan inline untuk
-- ribuan karyawan. Tabel ini menyimpan job batch yang diproses worker async
-- (idempoten, resumable). Bila tabel kosong/worker tidak jalan, jalur inline
-- lama tetap menjadi fallback.

DO $$ BEGIN CREATE TYPE gpa_batch_status_enum AS ENUM ('PENDING','RUNNING','COMPLETED','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS gpa_batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES appraisal_periods(id) ON DELETE CASCADE,
  status gpa_batch_status_enum NOT NULL DEFAULT 'PENDING',
  total_count INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_by UUID,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gpa_batch_jobs_status
  ON gpa_batch_jobs (status, created_at);
