-- 0052: Perpustakaan SOP/PP + acknowledgment berversi (PRD v2.0 §5.9, §10.3 F).
DO $$ BEGIN CREATE TYPE policy_type_enum AS ENUM ('SOP', 'PP', 'SK', 'IK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE policy_status_enum AS ENUM ('DRAFT', 'AKTIF', 'OBSOLETE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS policy_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_code VARCHAR(60) NOT NULL,
  title VARCHAR(255) NOT NULL,
  policy_type policy_type_enum NOT NULL,
  version VARCHAR(20) NOT NULL,
  owner_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  effective_date DATE NOT NULL,
  file_url TEXT NOT NULL,
  status policy_status_enum NOT NULL DEFAULT 'DRAFT',
  supersedes_id UUID REFERENCES policy_documents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (document_code, version)
);

CREATE INDEX IF NOT EXISTS idx_policy_active
  ON policy_documents (policy_type, status, effective_date DESC);

CREATE TABLE IF NOT EXISTS policy_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_document_id UUID NOT NULL REFERENCES policy_documents(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (policy_document_id, employee_id)
);
