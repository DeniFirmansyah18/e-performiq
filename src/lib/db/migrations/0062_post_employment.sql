-- 0062: Fitur fase Pasca-Kerja lanjutan — pensiun, serah terima aset,
-- surat pengalaman kerja, kepatuhan pasca-kerja, dan direktori alumni.
-- Aditif & idempoten (ADR 003): semua tabel/kolom baru, tanpa menyentuh data lama.

-- ===== 1. Manajemen pensiun =====
-- Tanggal lahir dibutuhkan untuk memproyeksikan usia pensiun. Nullable: data
-- lama tidak dipaksa diisi, dan panel menandai karyawan tanpa tanggal lahir.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS retirement_date DATE;

CREATE TABLE IF NOT EXISTS retirement_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  planned_retirement_date DATE NOT NULL,
  successor_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  successor_readiness VARCHAR(20) NOT NULL DEFAULT 'NOT_ASSESSED'
    CHECK (successor_readiness IN ('NOT_ASSESSED', 'NOT_READY', 'DEVELOPING', 'READY', 'READY_NOW')),
  knowledge_transfer_status VARCHAR(20) NOT NULL DEFAULT 'NOT_STARTED'
    CHECK (knowledge_transfer_status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id)
);

CREATE INDEX IF NOT EXISTS idx_retirement_plans_date
  ON retirement_plans (planned_retirement_date);

-- ===== 2. Serah terima & pengembalian aset (clearance) =====
CREATE TABLE IF NOT EXISTS clearance_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  asset_name VARCHAR(200) NOT NULL,
  asset_category VARCHAR(20) NOT NULL DEFAULT 'OTHER'
    CHECK (asset_category IN ('LAPTOP', 'PHONE', 'ACCESS_CARD', 'VEHICLE', 'DOCUMENT', 'CREDENTIAL', 'OTHER')),
  asset_code VARCHAR(100),
  is_returned BOOLEAN NOT NULL DEFAULT FALSE,
  returned_at TIMESTAMPTZ,
  verified_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clearance_assets_employee
  ON clearance_assets (employee_id);

CREATE TABLE IF NOT EXISTS clearance_signoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  department VARCHAR(30) NOT NULL
    CHECK (department IN ('HR', 'IT', 'FINANCE', 'MANAGER', 'LEGAL')),
  is_cleared BOOLEAN NOT NULL DEFAULT FALSE,
  cleared_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  cleared_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, department)
);

-- ===== 3. Surat pengalaman kerja & sertifikat =====
CREATE TABLE IF NOT EXISTS service_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  letter_number VARCHAR(60) UNIQUE NOT NULL,
  verification_code VARCHAR(40) UNIQUE NOT NULL,
  letter_type VARCHAR(30) NOT NULL DEFAULT 'EXPERIENCE'
    CHECK (letter_type IN ('EXPERIENCE', 'REFERENCE', 'SALARY', 'EMPLOYMENT')),
  issued_date DATE NOT NULL,
  position_title VARCHAR(200) NOT NULL,
  department_name VARCHAR(200) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  purpose VARCHAR(300),
  notes TEXT,
  issued_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_letters_employee
  ON service_letters (employee_id, issued_date DESC);

-- ===== 4. Kepatuhan pasca-kerja (deregistrasi & dokumen pajak) =====
CREATE TABLE IF NOT EXISTS post_employment_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  obligation_code VARCHAR(40) NOT NULL
    CHECK (obligation_code IN (
      'BPJS_KES_DEACTIVATE',
      'BPJS_TK_DEACTIVATE',
      'TAX_FORM_1721A1',
      'DPLK_SETTLEMENT',
      'PENSION_FILE_CLOSE',
      'ASSET_RETURN_LETTER'
    )),
  title VARCHAR(200) NOT NULL,
  due_date DATE NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  reference_no VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, obligation_code)
);

CREATE INDEX IF NOT EXISTS idx_post_employment_obligations_due
  ON post_employment_obligations (due_date) WHERE is_completed = FALSE;

-- ===== 5. Direktori alumni & peluang rekrut ulang =====
CREATE TABLE IF NOT EXISTS alumni_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
  exit_date DATE NOT NULL,
  exit_reason VARCHAR(100),
  last_position VARCHAR(200),
  last_department VARCHAR(200),
  performance_rating VARCHAR(5),
  is_regrettable BOOLEAN NOT NULL DEFAULT FALSE,
  rehire_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  rehire_reason TEXT,
  contact_email VARCHAR(150),
  contact_phone VARCHAR(30),
  consent_to_contact BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alumni_records_exit_date
  ON alumni_records (exit_date DESC);
