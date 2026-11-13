-- Poin pelanggaran pada sanksi disiplin.
--
-- Tujuan: pegawai dapat melihat total poin pelanggaran yang diterimanya, dan
-- HR dapat menetapkan besaran poin saat menerbitkan sanksi. Poin dipakai
-- sebagai dasar penilaian kepatuhan (Pilar Kepatuhan Prosedur) serta untuk
-- menentukan eskalasi sanksi berikutnya.
--
-- `violation_points` boleh NULL untuk data lama; aplikasi mengisi bobot bawaan
-- menurut jenis sanksi bila kosong:
--   TEGURAN=1, SP1=5, SP2=10, SP3=20
ALTER TABLE disciplinary_actions
  ADD COLUMN IF NOT EXISTS violation_points INTEGER;

-- Kategori pelanggaran memudahkan rekap per jenis (mis. ABSENSI, KODE_ETIK).
ALTER TABLE disciplinary_actions
  ADD COLUMN IF NOT EXISTS violation_category VARCHAR(40);

-- Catatan: poin hanya berlaku selama sanksi masih aktif (expiry_date belum
-- lewat), sehingga perhitungan total dilakukan di layanan.
CREATE INDEX IF NOT EXISTS idx_disciplinary_employee_active
  ON disciplinary_actions (employee_id, expiry_date);
