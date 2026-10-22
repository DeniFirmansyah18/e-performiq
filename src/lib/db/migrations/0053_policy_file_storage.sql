-- 0053: Berkas SOP tersimpan (unggahan PDF) — PRD v2.0 §5.9.
-- `file_url` tetap ada untuk dokumen lama yang merujuk URL eksternal;
-- dokumen baru menyimpan `storage_key` dan diunduh lewat endpoint aplikasi.
ALTER TABLE policy_documents
  ALTER COLUMN file_url DROP NOT NULL;

ALTER TABLE policy_documents
  ADD COLUMN IF NOT EXISTS storage_key TEXT,
  ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS file_size INT,
  ADD COLUMN IF NOT EXISTS checksum_sha256 VARCHAR(64),
  ADD COLUMN IF NOT EXISTS scan_status VARCHAR(20) NOT NULL DEFAULT 'SKIPPED'
    CHECK (scan_status IN ('CLEAN', 'INFECTED', 'SKIPPED')),
  ADD COLUMN IF NOT EXISTS scan_engine VARCHAR(40),
  ADD COLUMN IF NOT EXISTS page_count INT;

-- Setiap dokumen harus punya sumber berkas: URL lama atau objek tersimpan.
ALTER TABLE policy_documents
  DROP CONSTRAINT IF EXISTS policy_documents_source_check;
ALTER TABLE policy_documents
  ADD CONSTRAINT policy_documents_source_check
  CHECK (file_url IS NOT NULL OR storage_key IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS idx_policy_storage_key
  ON policy_documents (storage_key) WHERE storage_key IS NOT NULL;
