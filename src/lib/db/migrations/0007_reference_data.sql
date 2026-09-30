-- 0007: reference data tables (industry benchmarks + corporate vision/mission)
-- Nilai benchmark industri sebelumnya hardcoded di route; dipindah ke tabel agar dapat
-- diubah tanpa kode. Idempoten (IF NOT EXISTS) sesuai ADR 003.

CREATE TABLE IF NOT EXISTS industry_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_code VARCHAR(50) UNIQUE NOT NULL,
  metric_name VARCHAR(150) NOT NULL,
  benchmark_value DECIMAL(10,2) NOT NULL,
  unit VARCHAR(30),
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_vision_mission (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  vision TEXT NOT NULL,
  mission TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
