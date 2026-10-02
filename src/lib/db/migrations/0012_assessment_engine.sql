-- 0012: Mesin asesmen kandidat — psikometri (IPIP/CTT), teknis (bank soal), wawancara.
-- Idempotent (ADR 003). Bobot: psikometri 30% + teknis 40% + wawancara 30%.

-- ============================================================
-- Enums
-- ============================================================
DO $$ BEGIN CREATE TYPE assessment_type_enum AS ENUM ('PSYCHOMETRIC','TECHNICAL','INTERVIEW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE assessment_status_enum AS ENUM ('NOT_STARTED','IN_PROGRESS','SUBMITTED','SCORED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE question_type_enum AS ENUM ('MCQ','LIKERT','CODING','OPEN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- Template & bank soal
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(60) UNIQUE NOT NULL,
  title VARCHAR(200) NOT NULL,
  type assessment_type_enum NOT NULL,
  weight NUMERIC(5,2) NOT NULL,          -- 30 / 40 / 30
  description TEXT,
  position_id UUID REFERENCES job_positions(id), -- NULL = generik
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES assessment_templates(id) ON DELETE CASCADE,
  order_index INT NOT NULL DEFAULT 0,
  type question_type_enum NOT NULL DEFAULT 'MCQ',
  prompt TEXT NOT NULL,
  options JSONB,                          -- untuk MCQ/LIKERT: [{key,label,score}]
  correct_key VARCHAR(10),                -- untuk MCQ
  scale VARCHAR(60),                      -- untuk LIKERT (mis. 'BIG5-C')
  reverse_scored BOOLEAN NOT NULL DEFAULT FALSE,
  irt_a NUMERIC(6,3),                     -- diskriminasi (2PL) — opsional
  irt_b NUMERIC(6,3),                     -- kesulitan (1PL/2PL) — opsional
  source VARCHAR(60) DEFAULT 'IPIP',      -- IPIP | HUMANEVAL | MBPP | MMLU | CUSTOM
  source_ref TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Attempt & jawaban (menyimpan respon per-item untuk kalibrasi IRT nanti)
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES assessment_templates(id) ON DELETE RESTRICT,
  status assessment_status_enum NOT NULL DEFAULT 'NOT_STARTED',
  score NUMERIC(5,2),                     -- skor komponen (0-100)
  raw_score NUMERIC(5,2),                 -- skor mentah (sum/Likert)
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (application_id, template_id)
);

CREATE TABLE IF NOT EXISTS assessment_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES assessment_questions(id) ON DELETE CASCADE,
  answer_key VARCHAR(10),
  answer_text TEXT,
  is_correct BOOLEAN,
  score NUMERIC(6,2),
  UNIQUE (attempt_id, question_id)
);

-- Hasil agregat 30/40/30 per lamaran
CREATE TABLE IF NOT EXISTS candidate_assessment_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL UNIQUE REFERENCES job_applications(id) ON DELETE CASCADE,
  psychometric_score NUMERIC(5,2),
  technical_score NUMERIC(5,2),
  interview_score NUMERIC(5,2),
  final_weighted_score NUMERIC(5,2),
  computed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
