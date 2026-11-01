-- 0037: Penerima notifikasi lintas-role.
-- Notifikasi tidak lagi hanya milik `employee_id`: suatu aksi bisnis dapat
-- menargetkan PENGGUNA tertentu (recipient_user_id) atau PERAN (recipient_role),
-- sehingga HR/Atasan/Komite Kalibrasi/Pengawas dapat menerima pemberitahuan atas
-- perubahan yang relevan dengan tugasnya. Backfill baris lama ke user karyawan.

ALTER TABLE employee_notifications
  ALTER COLUMN employee_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS recipient_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS recipient_role user_role_enum,
  ADD COLUMN IF NOT EXISTS link TEXT;

-- Backfill: notifikasi lama (per karyawan) → penerima = user karyawan tsb.
UPDATE employee_notifications n
   SET recipient_user_id = u.id
  FROM users u
 WHERE n.recipient_user_id IS NULL
   AND n.employee_id IS NOT NULL
   AND u.employee_id = n.employee_id;

CREATE INDEX IF NOT EXISTS idx_employee_notifications_user
  ON employee_notifications (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employee_notifications_role_unread
  ON employee_notifications (recipient_role, is_read)
  WHERE recipient_role IS NOT NULL AND is_read = FALSE;
