-- 0064_relax_calibration_lock.sql
-- Kalibrasi penilaian dihapus dari aplikasi (fitur, endpoint, dan UI).
-- Trigger `trg_appraisal_immutable` masih memblokir perubahan baris yang dulu
-- berstatus `is_calibrated = TRUE`, sehingga nilai warisan tidak bisa dihitung
-- ulang dan POST /calculate-gpa gagal 500 pada baris lama tersebut.
--
-- Urutan penting: trigger DILEPAS lebih dulu, karena UPDATE pembuka kunci di
-- bawah ini justru akan ditolak oleh trigger lama (ayam-dan-telur).
-- Idempoten: aman dijalankan berulang.

-- 1) Lepas trigger lama agar nilai warisan bisa dibuka.
DROP TRIGGER IF EXISTS trg_appraisal_immutable ON performance_appraisals;

-- 2) Buka kunci data warisan.
UPDATE performance_appraisals SET is_calibrated = FALSE WHERE is_calibrated = TRUE;

-- 3) Ganti fungsi trigger menjadi permisif (hanya menyegarkan updated_at).
CREATE OR REPLACE FUNCTION prevent_calibrated_appraisal_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4) Pasang kembali trigger dengan fungsi permisif.
DROP TRIGGER IF EXISTS trg_appraisal_immutable ON performance_appraisals;
CREATE TRIGGER trg_appraisal_immutable
  BEFORE UPDATE ON performance_appraisals
  FOR EACH ROW EXECUTE FUNCTION prevent_calibrated_appraisal_update();
