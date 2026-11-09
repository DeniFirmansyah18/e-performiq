-- 0064_relax_calibration_lock.sql
-- Kalibrasi penilaian dihapus dari aplikasi (fitur, endpoint, dan UI).
-- Trigger `trg_appraisal_immutable` masih memblokir perubahan baris yang dulu
-- berstatus `is_calibrated = TRUE`, sehingga nilai warisan tidak bisa dihitung
-- ulang dan POST /calculate-gpa gagal 500 pada baris lama tersebut.
--
-- Migrasi ini:
--   1. Membuka kunci seluruh baris warisan (is_calibrated = FALSE).
--   2. Mengganti fungsi trigger menjadi no-op (selalu mengizinkan update),
--      sekaligus mempertahankan `updated_at` yang terus diperbarui.
-- Idempoten: aman dijalankan berulang.

-- 1) Buka kunci data warisan.
UPDATE performance_appraisals SET is_calibrated = FALSE WHERE is_calibrated = TRUE;

-- 2) Trigger tidak lagi memblokir; hanya menyegarkan updated_at.
CREATE OR REPLACE FUNCTION prevent_calibrated_appraisal_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Pastikan trigger tetap terpasang (fungsi baru sudah permisif).
DROP TRIGGER IF EXISTS trg_appraisal_immutable ON performance_appraisals;
CREATE TRIGGER trg_appraisal_immutable
  BEFORE UPDATE ON performance_appraisals
  FOR EACH ROW EXECUTE FUNCTION prevent_calibrated_appraisal_update();
