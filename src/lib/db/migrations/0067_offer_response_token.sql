-- 0067: Token respons penawaran kerja untuk kandidat.
--
-- Kandidat menerima tautan berisi token acak melalui email/WhatsApp, lalu
-- memilih Terima atau Tolak tanpa perlu membuat akun. Token disimpan sebagai
-- hash SHA-256 (bukan nilai mentah) supaya bocornya isi database tidak
-- membuat tautan orang lain bisa dipakai.
ALTER TABLE job_offers ADD COLUMN IF NOT EXISTS response_token_hash TEXT;
ALTER TABLE job_offers ADD COLUMN IF NOT EXISTS response_token_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_offers_response_token
  ON job_offers (response_token_hash) WHERE response_token_hash IS NOT NULL;
