-- 0023: kuota override per lowongan (job_postings.quota).
--
-- Sebelumnya kuota lowongan selalu diambil dari manpower_plans.approved_quota.
-- Kolom ini memungkinkan HR menetapkan kuota khusus per lowongan. Bila NULL,
-- sistem tetap fallback ke approved_quota MPP (kompatibel mundur).

ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS quota INTEGER;
