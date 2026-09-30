-- 0009: Moodle LMS model (Pre/During/Post lifecycle). Idempoten (ADR 003).

-- ---------- ENUMS ----------
DO $$ BEGIN CREATE TYPE course_phase_enum AS ENUM ('PRE','DURING','POST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE completion_state_enum AS ENUM ('NOT_STARTED','IN_PROGRESS','COMPLETE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE competency_outcome_enum AS ENUM ('COMPLETE','EVIDENCE','RECOMMEND','NONE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE evidence_source_enum AS ENUM ('COURSE','ACTIVITY','MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE evidence_action_enum AS ENUM ('COMPLETE','LOG','RECOMMEND');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE badge_type_enum AS ENUM ('COURSE','COMPETENCY','PHASE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE badge_criteria_type_enum AS ENUM ('COURSE','COMPETENCY','COURSESET');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE plan_status_enum AS ENUM ('DRAFT','ACTIVE','COMPLETE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE plan_item_status_enum AS ENUM ('TODO','IN_PROGRESS','DONE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- COMPETENCY FRAMEWORK ----------
CREATE TABLE IF NOT EXISTS competency_frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id UUID NOT NULL REFERENCES competency_frameworks(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES competencies(id) ON DELETE SET NULL,
  name VARCHAR(150) NOT NULL,
  taxonomy_level VARCHAR(30),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ---------- COURSES ----------
CREATE TABLE IF NOT EXISTS moodle_courses (
  id SERIAL PRIMARY KEY,
  course_code VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  description TEXT,
  target_phase course_phase_enum NOT NULL DEFAULT 'DURING',
  is_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
  default_hours DECIMAL(6,2) NOT NULL DEFAULT 0,
  level_min INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS course_competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id INT NOT NULL REFERENCES moodle_courses(id) ON DELETE CASCADE,
  competency_id UUID NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  outcome competency_outcome_enum NOT NULL DEFAULT 'COMPLETE',
  UNIQUE (course_id, competency_id)
);

-- ---------- EVIDENCE ----------
CREATE TABLE IF NOT EXISTS competency_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  competency_id UUID NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  source evidence_source_enum NOT NULL DEFAULT 'COURSE',
  course_id INT REFERENCES moodle_courses(id) ON DELETE SET NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  action evidence_action_enum NOT NULL DEFAULT 'LOG',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, competency_id, course_id)
);

-- ---------- BADGES ----------
CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  badge_type badge_type_enum NOT NULL DEFAULT 'COURSE',
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS badge_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  criteria_type badge_criteria_type_enum NOT NULL,
  course_id INT REFERENCES moodle_courses(id) ON DELETE CASCADE,
  competency_id UUID REFERENCES competencies(id) ON DELETE CASCADE,
  min_level INT
);

CREATE TABLE IF NOT EXISTS badge_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  evidence_ref TEXT,
  UNIQUE (badge_id, employee_id)
);

-- ---------- LEARNING PLANS (IDP) ----------
CREATE TABLE IF NOT EXISTS learning_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  status plan_status_enum NOT NULL DEFAULT 'DRAFT',
  period_id UUID REFERENCES appraisal_periods(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learning_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES learning_plans(id) ON DELETE CASCADE,
  competency_id UUID REFERENCES competencies(id) ON DELETE SET NULL,
  course_id INT REFERENCES moodle_courses(id) ON DELETE SET NULL,
  target_level INT,
  status plan_item_status_enum NOT NULL DEFAULT 'TODO'
);

-- ---------- EXTEND EXISTING ENROLLMENTS ----------
ALTER TABLE moodle_course_enrollments ADD COLUMN IF NOT EXISTS completion_state completion_state_enum DEFAULT 'NOT_STARTED';
ALTER TABLE moodle_course_enrollments ADD COLUMN IF NOT EXISTS time_spent_minutes INT DEFAULT 0;
ALTER TABLE moodle_course_enrollments ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;
