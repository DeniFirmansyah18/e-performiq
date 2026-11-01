-- 0061: Hapus peran ASSESSOR dari model aplikasi.
-- Postgres tidak dapat menghapus nilai dari sebuah enum, sehingga nilai
-- 'ASSESSOR' tetap ada di tipe `user_role_enum` demi kompatibilitas DDL.
-- Yang dilakukan migrasi ini adalah memindahkan seluruh akun lama ke
-- PEOPLE_MANAGER (yang kini memegang tugas kalibrasi), sehingga tidak ada
-- lagi baris users dengan peran yang sudah tidak dikenal aplikasi.
-- Tugas kalibrasi kini melekat pada Komite Kalibrasi (People Manager) dan BOD.

UPDATE users
   SET role = 'PEOPLE_MANAGER'
 WHERE role::text = 'ASSESSOR';
