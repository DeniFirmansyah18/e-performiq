-- 0028b: Template KPI per jabatan (position-kpi templates).
-- Memungkinkan auto-assign KPI yang relevan dengan jabatan karyawan saat
-- onboarding/konversi, bukan hanya 4 KPI generik. Bila jabatan tidak punya
-- template, sistem kembali ke starter KPI generik (fallback).

CREATE TABLE IF NOT EXISTS position_kpi_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID NOT NULL REFERENCES job_positions(id) ON DELETE CASCADE,
  kpi_title VARCHAR(200) NOT NULL,
  target_value NUMERIC(15,2) NOT NULL DEFAULT 100,
  unit_of_measure VARCHAR(60) NOT NULL DEFAULT '%',
  kpi_weight NUMERIC(5,2) NOT NULL,
  strategic_pillar_id UUID REFERENCES strategic_pillars(id) ON DELETE SET NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (position_id, kpi_title)
);

CREATE INDEX IF NOT EXISTS idx_position_kpi_templates_position
  ON position_kpi_templates (position_id, display_order);
