-- Task 10: kolom hash PIN slip gaji (bcrypt) — menggantikan perbandingan literal '123456'.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS payslip_pin_hash TEXT;
