-- 0019_employee_self_registration.sql
-- Registrasi mandiri karyawan: verifikasi email + approval HR.
DO $$ BEGIN
  CREATE TYPE employee_reg_status_enum AS ENUM
    ('PENDING_EMAIL','PENDING_APPROVAL','ACTIVE','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS employee_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(150) UNIQUE NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  phone_number VARCHAR(30),
  password_hash VARCHAR(255) NOT NULL,
  position_hint VARCHAR(150),
  verify_token VARCHAR(64),
  verify_expires_at TIMESTAMPTZ,
  status employee_reg_status_enum NOT NULL DEFAULT 'PENDING_EMAIL',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  reject_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_emp_reg_status ON employee_registrations(status);
CREATE INDEX IF NOT EXISTS idx_emp_reg_token ON employee_registrations(verify_token);
