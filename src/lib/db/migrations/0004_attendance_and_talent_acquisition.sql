-- ==================== KOTAK 1: ABSENSI & KEDISIPLINAN ====================
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  check_in TIME NOT NULL,
  check_out TIME NOT NULL,
  is_weekend BOOLEAN NOT NULL DEFAULT FALSE,
  is_sick_leave BOOLEAN NOT NULL DEFAULT FALSE,
  is_present BOOLEAN NOT NULL DEFAULT TRUE,
  total_work_hours DECIMAL(4,2) NOT NULL DEFAULT 8.00,
  total_overtime_hours DECIMAL(4,2) NOT NULL DEFAULT 0.00,
  source VARCHAR(20) NOT NULL DEFAULT 'MANUAL'
    CHECK (source IN ('MANUAL','MACHINE','KIOSK')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, work_date),
  CHECK (total_overtime_hours >= 0.00 AND total_overtime_hours <= 4.00),
  CHECK (total_work_hours > 0.00 AND total_work_hours <= 12.00),
  CHECK (check_out > check_in)
);

-- ==================== KOTAK 3: JOB BOARD & MOBILITAS INTERNAL ====================
CREATE TABLE IF NOT EXISTS job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manpower_plan_id UUID NOT NULL REFERENCES manpower_plans(id) ON DELETE RESTRICT,
  position_id UUID NOT NULL REFERENCES job_positions(id) ON DELETE RESTRICT,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  posting_title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  required_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_internal_only BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('DRAFT','OPEN','CLOSED','FILLED')),
  posted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS internal_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  applicant_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  cover_letter TEXT NOT NULL,
  cv_url TEXT NOT NULL,
  screening_score DECIMAL(5,2) CHECK (screening_score BETWEEN 0 AND 100),
  screening_summary TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('SUBMITTED','SHORTLISTED','INTERVIEW','OFFERED','REJECTED','WITHDRAWN')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (job_posting_id, applicant_employee_id)
);

CREATE TABLE IF NOT EXISTS interview_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  capacity INT NOT NULL DEFAULT 1 CHECK (capacity > 0),
  booked_count INT NOT NULL DEFAULT 0 CHECK (booked_count >= 0),
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (end_time > start_time)
);
