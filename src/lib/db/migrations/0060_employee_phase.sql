-- 0060: Fase siklus hidup karyawan + riwayat transisi (state machine eksplisit).
-- Aditif & idempoten (ADR 003). Kolom dibiarkan NULLABLE tanpa default: nilai
-- NULL berarti "belum ada transisi tercatat", sehingga pembaca dapat membedakan
-- karyawan yang memang DURING dari karyawan yang belum pernah diproses.
DO $$ BEGIN CREATE TYPE employee_phase_enum AS ENUM ('PRE', 'DURING', 'POST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS employee_phase employee_phase_enum;

-- Backfill satu langkah (bukan tiga UPDATE berurutan) karena PGlite hanya
-- mengeksekusi efek statement pertama pada beberapa pola batch multi-statement.
-- Prioritas: ada permintaan offboarding -> POST; onboarding belum tuntas atau
-- masih percobaan -> PRE; selain itu DURING.
UPDATE employees e
SET employee_phase = CASE
  WHEN EXISTS (SELECT 1 FROM offboarding_requests o WHERE o.employee_id = e.id)
    THEN 'POST'::employee_phase_enum
  WHEN EXISTS (
      SELECT 1 FROM onboarding_programs p
      WHERE p.employee_id = e.id AND p.status = 'IN_PROGRESS'
    )
    OR (e.employment_status = 'PROBATION' AND e.status <> 'PERMANENT')
    THEN 'PRE'::employee_phase_enum
  ELSE 'DURING'::employee_phase_enum
END
WHERE e.employee_phase IS NULL;

CREATE TABLE IF NOT EXISTS employee_phase_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  previous_phase employee_phase_enum,
  new_phase employee_phase_enum NOT NULL,
  effective_date DATE NOT NULL,
  reason TEXT,
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CHECK (previous_phase IS DISTINCT FROM new_phase)
);

CREATE INDEX IF NOT EXISTS idx_employee_phase_history_employee
  ON employee_phase_history (employee_id, effective_date DESC);

CREATE INDEX IF NOT EXISTS idx_employees_employee_phase
  ON employees (employee_phase);
