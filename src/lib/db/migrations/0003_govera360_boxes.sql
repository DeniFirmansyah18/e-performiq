-- ============================================================================
-- MIGRATION 0003: GOVERA360 6-BOX EXTENSION
-- ============================================================================

-- ==================== KOTAK 1: PRODUKTIVITAS & TIMESHEET ====================
CREATE TABLE IF NOT EXISTS daily_timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  regular_hours DECIMAL(4,2) NOT NULL DEFAULT 8.00,
  overtime_hours DECIMAL(4,2) NOT NULL DEFAULT 0.00 CHECK (overtime_hours >= 0.00 AND overtime_hours <= 4.00),
  task_summary TEXT NOT NULL,
  approval_status VARCHAR(20) NOT NULL DEFAULT 'APPROVED'
    CHECK (approval_status IN ('SUBMITTED','APPROVED','REJECTED')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, work_date)
);

CREATE TABLE IF NOT EXISTS kpi_evidence_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  individual_kpi_id UUID NOT NULL REFERENCES individual_kpis(id) ON DELETE CASCADE,
  file_title VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ==================== KOTAK 2: PETA KARIR & AKADEMI MOODLE ====================
CREATE TABLE IF NOT EXISTS career_path_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_position_id UUID NOT NULL REFERENCES job_positions(id) ON DELETE CASCADE,
  target_position_id UUID NOT NULL REFERENCES job_positions(id) ON DELETE CASCADE,
  min_gpa DECIMAL(4,2) NOT NULL DEFAULT 3.00,
  min_service_months INT NOT NULL DEFAULT 12,
  required_skills JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS moodle_course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  moodle_course_id INT NOT NULL,
  course_title VARCHAR(255) NOT NULL,
  completion_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  score DECIMAL(5,2),
  is_certified BOOLEAN NOT NULL DEFAULT FALSE,
  enrolled_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  UNIQUE (employee_id, moodle_course_id)
);

-- ==================== KOTAK 4: CORE HR, CUTI & KONTRAK ====================
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type VARCHAR(30) NOT NULL CHECK (leave_type IN ('ANNUAL','SICK','MATERNITY','SPECIAL')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INT NOT NULL CHECK (total_days > 0),
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('SUBMITTED','APPROVED','REJECTED','CANCELLED')),
  approver_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date >= start_date)
);

-- ==================== KOTAK 5: PENGUPAHAN & REIMBURSEMENT ====================
CREATE TABLE IF NOT EXISTS expense_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  claim_category VARCHAR(30) NOT NULL CHECK (claim_category IN ('MEDICAL','TRAVEL','OPERATIONAL')),
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  receipt_url TEXT NOT NULL,
  claim_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('SUBMITTED','APPROVED','PAID','REJECTED')),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ==================== KOTAK 6: HELPDESK & WHISTLEBLOWING ====================
CREATE TABLE IF NOT EXISTS helpdesk_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  is_whistleblowing BOOLEAN NOT NULL DEFAULT FALSE,
  ticket_category VARCHAR(50) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  detail TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW','MEDIUM','HIGH','URGENT')),
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')),
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
