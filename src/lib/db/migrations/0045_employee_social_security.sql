-- 0045: Kartu BPJS (PRD v2.0 §5.6, §10.3 D). Data RESTRICTED.
CREATE TABLE IF NOT EXISTS employee_social_security (
  employee_id UUID PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  bpjs_tk_number VARCHAR(20),
  bpjs_kes_number VARCHAR(20),
  bpjs_kes_class VARCHAR(20),
  bpjs_tk_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (bpjs_tk_status IN ('ACTIVE', 'INACTIVE', 'PENDING')),
  bpjs_kes_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (bpjs_kes_status IN ('ACTIVE', 'INACTIVE', 'PENDING')),
  registered_at DATE,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
