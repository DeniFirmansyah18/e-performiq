-- 0048: Kalender hari libur perusahaan (PRD v2.0 §5.6 — pengali lembur hari libur).
-- Dipakai untuk mengklasifikasikan tanggal lembur sebagai REST_DAY (2×/3×/4×).
CREATE TABLE IF NOT EXISTS company_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_company_holidays_date ON company_holidays (holiday_date);
