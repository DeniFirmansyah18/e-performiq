-- 0065_drop_recruitment_assessments.sql
-- Fitur Formulir Permintaan Tenaga Kerja (FPTK) dihapus atas permintaan pemilik
-- produk, termasuk data asesmen rekrutmen (Quality of Hire, time-to-fill, biaya).
-- Endpoint POST /pre-employment/assessments dan fungsi terkait sudah dihapus dari
-- kode; migrasi ini membersihkan tabelnya.
--
-- Dampak yang disadari: ringkasan MPP tidak lagi menampilkan metrik rekrutmen
-- (QoH, time-to-fill) karena sumbernya tabel ini. manpowan_plans TIDAK terhapus.
-- Idempoten: aman dijalankan berulang.

DROP TABLE IF EXISTS recruitment_assessments;
