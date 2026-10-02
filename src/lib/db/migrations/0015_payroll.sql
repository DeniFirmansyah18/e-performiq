-- 0015: Payroll lengkap — run per periode, item per karyawan, komponen gaji terkonfigurasi.
-- Idempotent (ADR 003). Selaras spec: docs/superpowers/specs/2026-10-02-rekrutmen-lms-payroll-design.md §4 (C2).

DO $$ BEGIN CREATE TYPE payroll_run_status_enum AS ENUM ('DRAFT','PROCESSING','APPROVED','PAID');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- C2a. Konfigurasi komponen gaji (tarif & parameter)
-- ============================================================
CREATE TABLE IF NOT EXISTS salary_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(60) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  component_type VARCHAR(20) NOT NULL DEFAULT 'EARNING'
    CHECK (component_type IN ('EARNING','DEDUCTION','EMPLOYER')),
  calc_method VARCHAR(30) NOT NULL DEFAULT 'PERCENT_OF_BASE'
    CHECK (calc_method IN ('FIXED','PERCENT_OF_BASE','FORMULA','BRACKET')),
  rate NUMERIC(8,5),        -- mis. 0.04 = 4%
  params JSONB,             -- konfigurasi tambahan (batas upah, bracket, dsb.)
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- C2b. Run payroll per periode
-- ============================================================
CREATE TABLE IF NOT EXISTS payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_code VARCHAR(20) NOT NULL,         -- mis. '2026-09'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status payroll_run_status_enum NOT NULL DEFAULT 'DRAFT',
  is_thr_month BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT,
  total_gross NUMERIC(18,2) DEFAULT 0,
  total_deductions NUMERIC(18,2) DEFAULT 0,
  total_net NUMERIC(18,2) DEFAULT 0,
  created_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (period_code)
);

-- ============================================================
-- C2c. Item payroll per karyawan (rincian komponen)
-- ============================================================
CREATE TABLE IF NOT EXISTS payroll_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  base_salary NUMERIC(15,2) NOT NULL DEFAULT 0,
  fixed_allowance NUMERIC(15,2) NOT NULL DEFAULT 0,
  overtime_pay NUMERIC(15,2) NOT NULL DEFAULT 0,
  bonus NUMERIC(15,2) NOT NULL DEFAULT 0,
  thr NUMERIC(15,2) NOT NULL DEFAULT 0,
  other_earnings JSONB DEFAULT '[]'::jsonb,
  bpjs_kesehatan NUMERIC(15,2) NOT NULL DEFAULT 0,       -- potongan karyawan 1%
  bpjs_jht NUMERIC(15,2) NOT NULL DEFAULT 0,             -- JHT karyawan 2%
  bpjs_jp NUMERIC(15,2) NOT NULL DEFAULT 0,              -- JP karyawan 1%
  pph21 NUMERIC(15,2) NOT NULL DEFAULT 0,
  other_deductions JSONB DEFAULT '[]'::jsonb,
  employer_bpjs JSONB DEFAULT '{}'::jsonb,               -- kontribusi pemberi kerja (info)
  overtime_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  present_days INT NOT NULL DEFAULT 0,
  working_days INT NOT NULL DEFAULT 0,
  gross NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(18,2) NOT NULL DEFAULT 0,
  net NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (run_id, employee_id)
);
