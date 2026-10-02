-- 0016: Detail lowongan untuk portal karier — pendidikan minimum, pengalaman minimum,
-- lokasi kerja, dan rentang gaji (opsional). Idempotent (ADR 003).
-- Melengkapi modul rekrutmen (WS-12): HR dapat membuat/mengelola lowongan dengan
-- kualifikasi lengkap, kuota dari MPP, dan status publikasi.

ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS min_education VARCHAR(100);
ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS min_experience_years NUMERIC(4,1);
ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS work_location VARCHAR(150);
ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS salary_min NUMERIC(15,2);
ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS salary_max NUMERIC(15,2);
ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS employment_type VARCHAR(30) DEFAULT 'PERMANENT';
