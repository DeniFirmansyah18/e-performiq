-- 0046: Sanksi & penghargaan (PRD v2.0 §5.6, §10.3 D).
DO $$ BEGIN CREATE TYPE disciplinary_type_enum AS ENUM ('TEGURAN', 'SP1', 'SP2', 'SP3');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE appeal_status_enum AS ENUM
  ('NONE', 'UNDER_APPEAL', 'APPEAL_ACCEPTED', 'APPEAL_REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS disciplinary_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  action_type disciplinary_type_enum NOT NULL,
  reason TEXT NOT NULL,
  evidence_url TEXT,
  effective_date DATE NOT NULL,
  expiry_date DATE,
  issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
  appeal_status appeal_status_enum NOT NULL DEFAULT 'NONE',
  appeal_deadline DATE NOT NULL,
  appeal_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CHECK (expiry_date IS NULL OR expiry_date >= effective_date)
);

CREATE INDEX IF NOT EXISTS idx_disciplinary_employee
  ON disciplinary_actions (employee_id, effective_date DESC);

CREATE TABLE IF NOT EXISTS recognitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  recognition_type VARCHAR(80) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  awarded_date DATE NOT NULL,
  certificate_url TEXT,
  points INT NOT NULL DEFAULT 0 CHECK (points >= 0),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recognitions_employee
  ON recognitions (employee_id, awarded_date DESC);
