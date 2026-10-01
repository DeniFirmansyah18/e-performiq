-- 0006: kolom akhir kontrak PKWT untuk contractDaysRemaining (Flight Risk)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_end_date DATE;
