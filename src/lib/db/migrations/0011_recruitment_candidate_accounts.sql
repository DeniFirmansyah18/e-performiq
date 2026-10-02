-- 0011: Modul rekrutmen end-to-end — akun kandidat, profil ATS, timeline, jadwal wawancara.
-- Idempotent (ADR 003). Selaras spec: docs/superpowers/specs/2026-10-02-rekrutmen-lms-payroll-design.md

-- ============================================================
-- Enums
-- ============================================================
DO $$ BEGIN CREATE TYPE timeline_stage_enum AS ENUM (
  'APPLIED','ATS_REVIEW','PSYCHOMETRIC','TECHNICAL','INTERVIEW','HR_REVIEW','DECISION'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE timeline_status_enum AS ENUM (
  'PENDING','IN_PROGRESS','PASSED','FAILED','SCHEDULED','SKIPPED'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE candidate_decision_enum AS ENUM (
  'PENDING','ACCEPTED','REJECTED','TALENT_POOL'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- A1. Akun kandidat (login terpisah dari users karyawan)
-- ============================================================
CREATE TABLE IF NOT EXISTS candidate_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  phone VARCHAR(30),
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- A3. Profil kandidat (hasil ATS) + relasi ke akun
-- ============================================================
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES candidate_accounts(id) ON DELETE SET NULL;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'PUBLIC_PORTAL';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS portfolio_url TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS summary TEXT;

CREATE TABLE IF NOT EXISTS candidate_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  skill_name VARCHAR(120) NOT NULL,
  level INT DEFAULT 1,
  years NUMERIC(4,1),
  source VARCHAR(20) DEFAULT 'ATS', -- ATS | MANUAL
  UNIQUE (candidate_id, skill_name)
);

CREATE TABLE IF NOT EXISTS candidate_educations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  institution VARCHAR(200),
  degree VARCHAR(120),
  major VARCHAR(120),
  start_year INT,
  end_year INT,
  gpa NUMERIC(3,2)
);

CREATE TABLE IF NOT EXISTS candidate_experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  company VARCHAR(200),
  role_title VARCHAR(150),
  start_date DATE,
  end_date DATE,
  description TEXT
);

-- ============================================================
-- A3. Hasil parsing resume / ATS
-- ============================================================
CREATE TABLE IF NOT EXISTS resume_parses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  application_id UUID REFERENCES job_applications(id) ON DELETE CASCADE,
  file_name VARCHAR(255),
  file_url TEXT,
  raw_text TEXT,
  parsed_json JSONB,
  ats_score NUMERIC(5,2),
  matched_skills JSONB,
  missing_skills JSONB,
  parser VARCHAR(40) DEFAULT 'HEURISTIC', -- HEURISTIC | AI
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- A4. Timeline progres lamaran
-- ============================================================
CREATE TABLE IF NOT EXISTS application_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  stage timeline_stage_enum NOT NULL,
  status timeline_status_enum NOT NULL DEFAULT 'PENDING',
  note TEXT,
  actor_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (application_id, stage)
);

-- ============================================================
-- A5.3. Jadwal wawancara online (perluas interview_slots)
-- ============================================================
CREATE TABLE IF NOT EXISTS interview_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  interviewer_user_id UUID REFERENCES users(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  meeting_url TEXT,
  duration_minutes INT DEFAULT 45,
  score NUMERIC(5,2),
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED', -- SCHEDULED | DONE | CANCELED
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- A6. Keputusan HR + catatan analisis AI
-- ============================================================
CREATE TABLE IF NOT EXISTS candidate_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL UNIQUE REFERENCES job_applications(id) ON DELETE CASCADE,
  decided_by_user_id UUID REFERENCES users(id),
  decision candidate_decision_enum NOT NULL DEFAULT 'PENDING',
  final_score NUMERIC(5,2),
  ai_summary TEXT,
  notes TEXT,
  decided_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
