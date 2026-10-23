-- 0054: Snapshot risiko attrition & burnout (PRD v2.0 §5.4 Modul 4).
-- Skor disimpan agar tren dapat dilihat dan agar feed aktivitas punya
-- kejadian nyata; perhitungannya murni di src/lib/engines/flightRiskEngine.ts.

CREATE TABLE IF NOT EXISTS employee_flight_risk_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  attrition_score SMALLINT NOT NULL CHECK (attrition_score BETWEEN 0 AND 100),
  attrition_band VARCHAR(10) NOT NULL
    CHECK (attrition_band IN ('LOW', 'MODERATE', 'HIGH', 'CRITICAL')),
  burnout_score SMALLINT NOT NULL CHECK (burnout_score BETWEEN 0 AND 100),
  burnout_band VARCHAR(10) NOT NULL
    CHECK (burnout_band IN ('LOW', 'MODERATE', 'HIGH', 'CRITICAL')),
  factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  computed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_flight_risk_attrition
  ON employee_flight_risk_snapshots (snapshot_date, attrition_band);

CREATE INDEX IF NOT EXISTS idx_flight_risk_burnout
  ON employee_flight_risk_snapshots (snapshot_date, burnout_band);
