-- 0030: Perkaya notifikasi karyawan (in-app & email).
-- Menambah kategori/severity, tautan aksi (CTA), dan penanda email terkirim
-- agar notifikasi lebih informatif: badge warna, tombol aksi, dan status kirim.

ALTER TABLE employee_notifications
  ADD COLUMN IF NOT EXISTS category VARCHAR(40) NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN IF NOT EXISTS severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
  ADD COLUMN IF NOT EXISTS action_url TEXT,
  ADD COLUMN IF NOT EXISTS email_status VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_employee_notifications_unread
  ON employee_notifications (employee_id, is_read) WHERE is_read = FALSE;
