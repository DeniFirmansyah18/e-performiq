-- 0025: Backfill karyawan hasil konversi kandidat lama + lengkapi jembatan orientasi.
--
-- Latar: sebelum perubahan "konversi → PERMANENT + jembatan onboarding", kandidat
-- HIRED dikonversi dengan status PROBATION dan tanpa baris onboarding_milestones.
-- Migrasi ini menyelaraskan data lama (idempotent, ADR 003):
--   1) Karyawan yang punya program onboarding (hasil konversi) tetapi masih
--      PROBATION → PERMANENT.
--   2) Pastikan setiap karyawan yang punya onboarding_programs punya baris
--      onboarding_milestones (anchor progres orientasi), tanpa menimpa skor.

-- 1) Karyawan dengan program onboarding tapi masih PROBATION → PERMANENT.
UPDATE employees e
   SET status = 'PERMANENT'::employee_status_enum
 WHERE e.status = 'PROBATION'::employee_status_enum
   AND EXISTS (SELECT 1 FROM onboarding_programs op WHERE op.employee_id = e.id);

-- 2) Lengkapi baris milestone untuk setiap program onboarding yang belum punya.
INSERT INTO onboarding_milestones (employee_id, probation_passed)
SELECT op.employee_id, FALSE
  FROM onboarding_programs op
 WHERE NOT EXISTS (
   SELECT 1 FROM onboarding_milestones om WHERE om.employee_id = op.employee_id
 )
ON CONFLICT (employee_id) DO NOTHING;
