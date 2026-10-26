-- 0057: Cache hasil analisis AI per (fitur, periode, peran).
-- Aditif & idempoten (ADR 003). Tanpa cache, setiap klik "Analisis ulang"
-- memanggil provider dan berisiko kena rate limit saat rapat BOD.
CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature VARCHAR(64) NOT NULL,
  period_code VARCHAR(50) NOT NULL DEFAULT 'ALL',
  role VARCHAR(40) NOT NULL,
  insight TEXT NOT NULL,
  provider VARCHAR(32),
  payload_hash CHAR(64) NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (feature, period_code, role)
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_lookup
  ON ai_insights (feature, period_code, role);
