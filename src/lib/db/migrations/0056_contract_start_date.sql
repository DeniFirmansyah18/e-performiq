-- 0056: Tanggal mulai kontrak PKWT (melengkapi contract_end_date dari 0006).
-- Aditif & idempoten: kolom nullable, tanpa backfill paksa agar data berjalan tetap valid.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_start_date DATE;

-- Isi hanya bila belum ada: pakai tanggal bergabung sebagai perkiraan awal kontrak.
UPDATE employees
   SET contract_start_date = join_date
 WHERE contract_start_date IS NULL
   AND employment_status = 'PKWT'
   AND join_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employees_contract_window
  ON employees (contract_end_date, contract_start_date)
  WHERE contract_end_date IS NOT NULL;