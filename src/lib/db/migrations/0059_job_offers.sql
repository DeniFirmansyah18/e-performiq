-- 0059: Register penawaran kerja (offer register) untuk alur OFFERED → HIRED.
--
-- Melengkapi ADR 022: selama ini hanya STATUS lamaran yang berubah, tanpa jejak
-- siapa menawarkan, kapan, berapa gaji yang ditawarkan, dan sampai kapan kandidat
-- harus merespons. Tabel ini menjadi sumber kebenaran penawaran + jejak audit
-- penawaran (dipakai juga untuk audit trail), tanpa mengubah CHECK constraint
-- status lamaran.
--
-- Aditif & idempoten (ADR 003). Satu lamaran punya paling banyak satu penawaran
-- aktif; penawaran ulang (re-offer) memperbarui baris yang sama.
DO $$ BEGIN CREATE TYPE offer_status_enum AS ENUM
  ('SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS job_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL UNIQUE REFERENCES job_applications(id) ON DELETE CASCADE,
  offered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status offer_status_enum NOT NULL DEFAULT 'SENT',
  base_salary NUMERIC(15,2) NOT NULL CHECK (base_salary >= 0),
  fixed_allowance NUMERIC(15,2) NOT NULL DEFAULT 0,
  offered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  response_deadline TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  response_note TEXT,
  letter_agenda_number VARCHAR(60),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_job_offers_deadline
  ON job_offers (status, response_deadline);