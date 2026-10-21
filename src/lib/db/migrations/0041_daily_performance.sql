-- 0041: Ambang DPI, snapshot harian, dan view rekap (PRD v2.0 §10.3 C, G).
DO $$ BEGIN CREATE TYPE traffic_light_enum AS ENUM ('GREEN', 'YELLOW', 'RED', 'NO_DATA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS company_dpi_settings (
  company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  green_threshold DECIMAL(5,2) NOT NULL DEFAULT 90.00,
  yellow_threshold DECIMAL(5,2) NOT NULL DEFAULT 70.00,
  achievement_cap DECIMAL(5,2) NOT NULL DEFAULT 1.20,
  absence_demotes BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CHECK (green_threshold > yellow_threshold)
);

CREATE TABLE IF NOT EXISTS daily_performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  dpi_score DECIMAL(6,2),
  traffic_light traffic_light_enum NOT NULL DEFAULT 'NO_DATA',
  indicators_expected SMALLINT NOT NULL DEFAULT 0,
  indicators_filled SMALLINT NOT NULL DEFAULT 0,
  demotion_reason VARCHAR(60),
  computed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, snapshot_date),
  CHECK (dpi_score IS NULL OR dpi_score BETWEEN 0 AND 120)
);

CREATE INDEX IF NOT EXISTS idx_dpi_snapshot_date
  ON daily_performance_snapshots (snapshot_date, traffic_light);

CREATE OR REPLACE VIEW v_employee_daily_recap AS
SELECT
  s.employee_id,
  date_trunc('month', s.snapshot_date)::date AS period_month,
  count(*) FILTER (WHERE s.traffic_light = 'GREEN')   AS days_green,
  count(*) FILTER (WHERE s.traffic_light = 'YELLOW')  AS days_yellow,
  count(*) FILTER (WHERE s.traffic_light = 'RED')     AS days_red,
  count(*) FILTER (WHERE s.traffic_light = 'NO_DATA') AS days_no_data,
  round(avg(s.dpi_score) FILTER (WHERE s.dpi_score IS NOT NULL), 2) AS avg_dpi,
  sum(s.indicators_filled)::numeric
    / NULLIF(sum(s.indicators_expected), 0) AS entry_adherence
FROM daily_performance_snapshots s
GROUP BY s.employee_id, date_trunc('month', s.snapshot_date);
