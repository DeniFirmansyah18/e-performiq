-- 0035: Selaraskan profil karyawan dengan data lamaran kandidat (ADR 003, idempotent).
--
-- Kandidat mengisi gender & NIK saat melamar (careers/apply). Kolom ini tidak pernah
-- dibawa ke `employees` saat konversi HIRED → karyawan, sehingga menu "Profil Saya"
-- tidak menampilkan data yang sama dengan saat mendaftar. Tambah kolom + backfill
-- untuk karyawan hasil konversi (cocokkan via email).

ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS nik VARCHAR(20);

-- Backfill dari kandidat dengan email sama (hanya bila belum terisi).
UPDATE employees e
   SET gender = c.gender
  FROM candidates c
 WHERE LOWER(e.email) = LOWER(c.email)
   AND e.gender IS NULL AND c.gender IS NOT NULL;

UPDATE employees e
   SET nik = c.nik
  FROM candidates c
 WHERE LOWER(e.email) = LOWER(c.email)
   AND e.nik IS NULL AND c.nik IS NOT NULL;

UPDATE employees e
   SET address = c.address
  FROM candidates c
 WHERE LOWER(e.email) = LOWER(c.email)
   AND e.address IS NULL AND c.address IS NOT NULL;

UPDATE employees e
   SET date_of_birth = c.birth_date
  FROM candidates c
 WHERE LOWER(e.email) = LOWER(c.email)
   AND e.date_of_birth IS NULL AND c.birth_date IS NOT NULL;
