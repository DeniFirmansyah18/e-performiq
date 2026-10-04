-- 0017: Data lamaran lengkap (WS-13) — gender, pendidikan detail, riwayat kerja,
-- sertifikasi, berkas lamaran, referensi institusi/jurusan, dan notifikasi progress.
-- Idempotent (ADR 003).

-- ============================================================
-- Gender pada kandidat
-- ============================================================
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS nik VARCHAR(20);

-- ============================================================
-- Pendidikan: lengkapi detail (jenjang, institusi kode, status kelulusan)
-- ============================================================
ALTER TABLE candidate_educations ADD COLUMN IF NOT EXISTS level VARCHAR(10);        -- SD|SMP|SMA/SMK|D3|D4|S1|S2
ALTER TABLE candidate_educations ADD COLUMN IF NOT EXISTS institution_code VARCHAR(30); -- NPSN / kode PT
ALTER TABLE candidate_educations ADD COLUMN IF NOT EXISTS graduation_status VARCHAR(20) DEFAULT 'LULUS'; -- LULUS|AKTIF
ALTER TABLE candidate_educations ADD COLUMN IF NOT EXISTS gpa NUMERIC(4,2);

-- ============================================================
-- Riwayat kerja: jenis (MAGANG|KERJA), periode bulan/tahun, lokasi
-- ============================================================
ALTER TABLE candidate_experiences ADD COLUMN IF NOT EXISTS experience_type VARCHAR(20) DEFAULT 'KERJA'; -- MAGANG|KERJA
ALTER TABLE candidate_experiences ADD COLUMN IF NOT EXISTS start_month INT;
ALTER TABLE candidate_experiences ADD COLUMN IF NOT EXISTS start_year INT;
ALTER TABLE candidate_experiences ADD COLUMN IF NOT EXISTS end_month INT;
ALTER TABLE candidate_experiences ADD COLUMN IF NOT EXISTS end_year INT;
ALTER TABLE candidate_experiences ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT FALSE;
ALTER TABLE candidate_experiences ADD COLUMN IF NOT EXISTS location VARCHAR(200);

-- ============================================================
-- Sertifikasi / penghargaan
-- ============================================================
DO $$ BEGIN CREATE TYPE certification_kind_enum AS ENUM ('CERTIFICATION','AWARD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS candidate_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  kind certification_kind_enum NOT NULL DEFAULT 'CERTIFICATION',
  name VARCHAR(255) NOT NULL,
  issuer VARCHAR(255),
  issued_date DATE,             -- tanggal terbit / waktu mendapatkan
  expiry_date DATE,             -- masa berlaku (opsional)
  credential_id VARCHAR(120),
  proof_url TEXT,               -- data URL / tautan bukti
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Berkas lamaran (CV, surat lamaran, dokumen pendukung) — disimpan di DB
-- ============================================================
CREATE TABLE IF NOT EXISTS candidate_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  application_id UUID REFERENCES job_applications(id) ON DELETE CASCADE,
  doc_type VARCHAR(30) NOT NULL,  -- CV | COVER_LETTER | CERTIFICATE | OTHER
  file_name VARCHAR(255),
  mime_type VARCHAR(120),
  file_url TEXT,                  -- data URL (base64) disimpan di DB
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Notifikasi kandidat (in-app) + outbox email
-- ============================================================
CREATE TABLE IF NOT EXISTS candidate_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  account_id UUID REFERENCES candidate_accounts(id) ON DELETE CASCADE,
  application_id UUID REFERENCES job_applications(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  stage VARCHAR(40),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN CREATE TYPE email_status_enum AS ENUM ('QUEUED','SENT','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient VARCHAR(200) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT,
  status email_status_enum NOT NULL DEFAULT 'QUEUED',
  provider VARCHAR(40),
  error TEXT,
  related_application_id UUID REFERENCES job_applications(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Referensi institusi pendidikan & jurusan (fallback lokal untuk pencarian)
-- ============================================================
CREATE TABLE IF NOT EXISTS education_institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  level VARCHAR(10),            -- SD|SMP|SMA/SMK|PT
  code VARCHAR(30),             -- NPSN / kode PT
  city VARCHAR(120),
  province VARCHAR(120),
  UNIQUE (name, level)
);

CREATE TABLE IF NOT EXISTS education_majors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL UNIQUE,
  group_name VARCHAR(120)
);
