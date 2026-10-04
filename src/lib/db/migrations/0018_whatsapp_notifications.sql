-- 0018: Notifikasi WhatsApp untuk kandidat (WS-14).
-- Antrean + log pengiriman pesan WhatsApp, provider-agnostic. Idempotent (ADR 003).

DO $$ BEGIN CREATE TYPE wa_status_enum AS ENUM ('QUEUED','SENT','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS whatsapp_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(30) NOT NULL,          -- nomor tujuan (E.164 tanpa '+', mis. 62812...)
  message TEXT NOT NULL,
  status wa_status_enum NOT NULL DEFAULT 'QUEUED',
  provider VARCHAR(40),                -- FONNTE | WABLAS | META | WEBHOOK
  error TEXT,
  related_application_id UUID REFERENCES job_applications(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_app ON whatsapp_outbox (related_application_id);
