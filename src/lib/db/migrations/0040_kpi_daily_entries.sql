-- 0040: Indikator & entri KPI harian (PRD v2.0 §10.3 B).
CREATE TYPE kpi_direction_enum AS ENUM ('HIGHER_BETTER', 'LOWER_BETTER');
CREATE TYPE kpi_frequency_enum AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
CREATE TYPE kpi_aggregation_enum AS ENUM ('SUM', 'AVG', 'LAST', 'MAX');
CREATE TYPE daily_entry_status_enum AS ENUM
  ('DRAFT', 'SUBMITTED', 'VERIFIED', 'REJECTED');

CREATE TABLE IF NOT EXISTS kpi_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id UUID NOT NULL REFERENCES individual_kpis(id) ON DELETE CASCADE,
  indicator_name VARCHAR(200) NOT NULL,
  unit_of_measure VARCHAR(50) NOT NULL DEFAULT '%',
  target_value DECIMAL(12,2) NOT NULL CHECK (target_value > 0),
  direction kpi_direction_enum NOT NULL DEFAULT 'HIGHER_BETTER',
  frequency kpi_frequency_enum NOT NULL DEFAULT 'DAILY',
  aggregation kpi_aggregation_enum NOT NULL DEFAULT 'AVG',
  indicator_weight DECIMAL(5,2) NOT NULL DEFAULT 100
    CHECK (indicator_weight > 0 AND indicator_weight <= 100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (kpi_id, indicator_name)
);

CREATE TABLE IF NOT EXISTS kpi_daily_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id UUID NOT NULL REFERENCES kpi_indicators(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  actual_value DECIMAL(12,2) NOT NULL CHECK (actual_value >= 0),
  note TEXT,
  evidence_url TEXT,
  status daily_entry_status_enum NOT NULL DEFAULT 'DRAFT',
  is_late BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at TIMESTAMPTZ,
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (indicator_id, employee_id, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_kpi_daily_employee_date
  ON kpi_daily_entries (employee_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_kpi_daily_pending
  ON kpi_daily_entries (status, entry_date) WHERE status = 'SUBMITTED';
