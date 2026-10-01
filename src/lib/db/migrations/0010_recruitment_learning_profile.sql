-- 0010: course materials, certificates, public recruitment, self-service profile. Idempotent (ADR 003).
DO $$ BEGIN CREATE TYPE content_type_enum AS ENUM ('TEXT','VIDEO','PDF','QUIZ');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE application_status_enum AS ENUM ('SUBMITTED','SCREENING','INTERVIEW','OFFERED','HIRED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS course_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id INT NOT NULL REFERENCES moodle_courses(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  content_type content_type_enum NOT NULL DEFAULT 'TEXT',
  content_url TEXT,
  content_body TEXT,
  quiz_key JSONB
);

CREATE TABLE IF NOT EXISTS course_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  course_id INT NOT NULL REFERENCES moodle_courses(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, module_id)
);

CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_no VARCHAR(80) UNIQUE NOT NULL,
  verification_code VARCHAR(40) UNIQUE NOT NULL,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  course_id INT NOT NULL REFERENCES moodle_courses(id) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, course_id)
);

CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(200) NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(30),
  address TEXT,
  birth_date DATE,
  education VARCHAR(200),
  resume_url TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_no VARCHAR(40) UNIQUE NOT NULL,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_posting_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  cover_letter TEXT,
  status application_status_enum NOT NULL DEFAULT 'SUBMITTED',
  applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(150);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(30);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bio TEXT;
