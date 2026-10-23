-- 0055: Rantai hash pada audit_logs (PRD v2.0 §5.4 — cap waktu anti-tamper).
-- Trigger immutability (0001) mencegah UPDATE/DELETE biasa; kolom ini membuat
-- penyalahgunaan hak DBA (trigger dimatikan) tetap terdeteksi.
-- Baris lama dibiarkan NULL dan dilewati verifikasi sebagai data warisan.
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS prev_hash CHAR(64);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entry_hash CHAR(64);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entry_hash ON audit_logs (entry_hash);
