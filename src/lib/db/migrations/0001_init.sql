-- ============================== ENUM (7) ==============================
CREATE TYPE bsc_perspective_enum AS ENUM
  ('FINANCIAL','CUSTOMER','INTERNAL_PROCESS','LEARNING_GROWTH');
CREATE TYPE employee_status_enum AS ENUM
  ('PROBATION','PERMANENT','CONTRACT','RESIGNED','RETIRED');
CREATE TYPE user_role_enum AS ENUM
  ('SUPER_ADMIN','BOD','HR_MANAGER','PEOPLE_MANAGER','EMPLOYEE','AUDITOR');
CREATE TYPE period_status_enum AS ENUM
  ('DRAFT','ACTIVE','CALIBRATION','LOCKED');
CREATE TYPE nine_box_quadrant_enum AS ENUM
  ('ENIGMA','GROWTH_STAR','FUTURE_LEADER','DILEMMA','CORE_PLAYER',
   'HIGH_IMPACT','UNDERPERFORMER','EFFECTIVE_PRO','TRUSTED_PRO');
CREATE TYPE offboarding_status_enum AS ENUM
  ('INITIATED','CLEARANCE_IN_PROGRESS','COMPLETED','DISPUTED');
CREATE TYPE kpi_status_enum AS ENUM
  ('DRAFT','SUBMITTED','APPROVED','REJECTED');

-- ============================ ORGANISASI ==============================
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(200) NOT NULL,
  legal_entity_code VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  department_name VARCHAR(200) NOT NULL,
  division_name VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE job_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  position_title VARCHAR(200) NOT NULL,
  job_grade VARCHAR(20),
  competency_dictionary JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  phone_number VARCHAR(30),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  position_id UUID NOT NULL REFERENCES job_positions(id) ON DELETE RESTRICT,
  manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  status employee_status_enum DEFAULT 'PROBATION',
  base_salary DECIMAL(15,2) NOT NULL CHECK (base_salary >= 0),
  join_date DATE NOT NULL,
  last_working_day DATE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role user_role_enum NOT NULL DEFAULT 'EMPLOYEE',
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ================== STRATEGIS (Cascade Level 1-3) ====================
CREATE TABLE strategic_pillars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  perspective bsc_perspective_enum NOT NULL,
  pillar_name VARCHAR(150) NOT NULL,
  description TEXT,
  strategic_weight DECIMAL(5,2) NOT NULL
    CHECK (strategic_weight > 0 AND strategic_weight <= 100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE corporate_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategic_pillar_id UUID NOT NULL
    REFERENCES strategic_pillars(id) ON DELETE RESTRICT,
  period_year INT NOT NULL,
  kpi_code VARCHAR(50) UNIQUE NOT NULL,
  kpi_name VARCHAR(255) NOT NULL,
  target_value DECIMAL(15,2) NOT NULL,
  unit_of_measure VARCHAR(50) NOT NULL,
  calculation_formula TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE division_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corporate_kpi_id UUID NOT NULL REFERENCES corporate_kpis(id) ON DELETE RESTRICT,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  kpi_title VARCHAR(255) NOT NULL,
  weight_pct DECIMAL(5,2) NOT NULL CHECK (weight_pct > 0 AND weight_pct <= 100),
  target_value DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ======================== FASE 2: KINERJA ============================
CREATE TABLE appraisal_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_code VARCHAR(50) UNIQUE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status period_status_enum DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date > start_date)
);

CREATE TABLE individual_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES appraisal_periods(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  strategic_pillar_id UUID NOT NULL
    REFERENCES strategic_pillars(id) ON DELETE RESTRICT,
  division_kpi_id UUID REFERENCES division_kpis(id) ON DELETE RESTRICT,
  kpi_title VARCHAR(255) NOT NULL,
  target_value DECIMAL(12,2) NOT NULL CHECK (target_value > 0),
  actual_value DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (actual_value >= 0),
  unit_of_measure VARCHAR(50) NOT NULL DEFAULT '%',
  kpi_weight DECIMAL(5,2) NOT NULL CHECK (kpi_weight > 0 AND kpi_weight <= 100),
  achievement_percentage DECIMAL(6,2) GENERATED ALWAYS AS (
    CASE WHEN target_value > 0 THEN (actual_value / target_value) * 100 ELSE 0 END
  ) STORED,
  status kpi_status_enum NOT NULL DEFAULT 'DRAFT',
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (period_id, employee_id, kpi_title)
);

CREATE TABLE sop_compliance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES appraisal_periods(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  total_assigned_tasks INT NOT NULL CHECK (total_assigned_tasks >= 0),
  sla_breach_count INT NOT NULL DEFAULT 0 CHECK (sla_breach_count >= 0),
  procedure_errors INT NOT NULL DEFAULT 0 CHECK (procedure_errors >= 0),
  compliance_percentage DECIMAL(5,2) NOT NULL
    CHECK (compliance_percentage BETWEEN 0 AND 100),
  internal_audit_findings TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (period_id, employee_id)
);

CREATE TABLE competency_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES appraisal_periods(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  skill_name VARCHAR(150) NOT NULL,
  skill_category VARCHAR(20) NOT NULL CHECK (skill_category IN ('HARD','SOFT')),
  required_level INT NOT NULL CHECK (required_level BETWEEN 1 AND 5),
  actual_level INT NOT NULL CHECK (actual_level BETWEEN 1 AND 5),
  gap DECIMAL(4,2) GENERATED ALWAYS AS (required_level - actual_level) STORED,
  score DECIMAL(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE peer_reviews_360 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES appraisal_periods(id) ON DELETE CASCADE,
  evaluatee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  evaluator_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  relationship_type VARCHAR(20) NOT NULL
    CHECK (relationship_type IN ('SUPERVISOR','PEER','SUBORDINATE')),
  integrity_score DECIMAL(4,2) NOT NULL CHECK (integrity_score BETWEEN 1 AND 5),
  collaboration_score DECIMAL(4,2) NOT NULL
    CHECK (collaboration_score BETWEEN 1 AND 5),
  innovation_score DECIMAL(4,2) NOT NULL CHECK (innovation_score BETWEEN 1 AND 5),
  average_core_value_score DECIMAL(4,2) GENERATED ALWAYS AS (
    (integrity_score + collaboration_score + innovation_score) / 3.0
  ) STORED,
  feedback_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (period_id, evaluatee_id, evaluator_id)
);

CREATE TABLE performance_appraisals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES appraisal_periods(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  kpi_composite_score DECIMAL(5,2) NOT NULL CHECK (kpi_composite_score BETWEEN 0 AND 100),
  sop_compliance_score DECIMAL(5,2) NOT NULL CHECK (sop_compliance_score BETWEEN 0 AND 100),
  competency_score DECIMAL(5,2) NOT NULL CHECK (competency_score BETWEEN 0 AND 100),
  core_values_score DECIMAL(5,2) NOT NULL CHECK (core_values_score BETWEEN 0 AND 100),
  total_percentage_score DECIMAL(5,2) NOT NULL CHECK (total_percentage_score BETWEEN 0 AND 100),
  composite_gpa DECIMAL(4,2) NOT NULL CHECK (composite_gpa BETWEEN 0 AND 4),
  performance_rating VARCHAR(1) NOT NULL CHECK (performance_rating IN ('A','B','C','D')),
  potential_score DECIMAL(4,2) NOT NULL CHECK (potential_score BETWEEN 1 AND 5),
  nine_box_quadrant nine_box_quadrant_enum NOT NULL,
  is_calibrated BOOLEAN NOT NULL DEFAULT FALSE,
  calibrated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  calibrated_at TIMESTAMPTZ,
  calibration_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (period_id, employee_id)
);

-- ==================== FASE 1 & 3 (Pre / Post) ========================
CREATE TABLE manpower_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  position_id UUID NOT NULL REFERENCES job_positions(id) ON DELETE RESTRICT,
  fiscal_year INT NOT NULL,
  approved_quota INT NOT NULL CHECK (approved_quota >= 0),
  allocated_budget DECIMAL(15,2) NOT NULL CHECK (allocated_budget >= 0),
  utilized_budget DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (utilized_budget >= 0),
  hired_count INT NOT NULL DEFAULT 0 CHECK (hired_count >= 0),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (department_id, position_id, fiscal_year)
);

CREATE TABLE hiring_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manpower_plan_id UUID NOT NULL REFERENCES manpower_plans(id) ON DELETE RESTRICT,
  requisition_code VARCHAR(50) UNIQUE NOT NULL,
  requested_date DATE NOT NULL,
  approved_date DATE,
  sla_target_days INT NOT NULL CHECK (sla_target_days > 0),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE recruitment_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_name VARCHAR(200) NOT NULL,
  applied_position_id UUID NOT NULL REFERENCES job_positions(id) ON DELETE RESTRICT,
  hiring_requisition_id UUID NOT NULL REFERENCES hiring_requisitions(id) ON DELETE RESTRICT,
  psychometric_score DECIMAL(5,2) CHECK (psychometric_score BETWEEN 0 AND 100),
  technical_test_score DECIMAL(5,2) CHECK (technical_test_score BETWEEN 0 AND 100),
  competency_interview_score DECIMAL(5,2) CHECK (competency_interview_score BETWEEN 0 AND 100),
  computed_qoh_score DECIMAL(5,2) NOT NULL CHECK (computed_qoh_score BETWEEN 0 AND 100),
  recruitment_cost DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (recruitment_cost >= 0),
  time_to_fill_days INT CHECK (time_to_fill_days >= 0),
  hiring_status VARCHAR(20) NOT NULL DEFAULT 'HIRED'
    CHECK (hiring_status IN ('APPLIED','SCREENING','INTERVIEWED','OFFERED','HIRED','REJECTED')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE onboarding_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  day_30_score DECIMAL(5,2) CHECK (day_30_score BETWEEN 0 AND 100),
  day_60_score DECIMAL(5,2) CHECK (day_60_score BETWEEN 0 AND 100),
  day_90_score DECIMAL(5,2) CHECK (day_90_score BETWEEN 0 AND 100),
  manager_notes TEXT,
  probation_passed BOOLEAN NOT NULL DEFAULT FALSE,
  conversion_date DATE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id)
);

CREATE TABLE offboarding_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reason_for_leaving VARCHAR(100) NOT NULL,
  resignation_notice_date DATE NOT NULL,
  last_working_day DATE NOT NULL,
  is_regrettable_attrition BOOLEAN NOT NULL DEFAULT FALSE,
  status offboarding_status_enum NOT NULL DEFAULT 'INITIATED',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CHECK (last_working_day >= resignation_notice_date)
);

CREATE TABLE knowledge_handovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offboarding_request_id UUID NOT NULL
    REFERENCES offboarding_requests(id) ON DELETE CASCADE,
  handover_item_name VARCHAR(255) NOT NULL,
  category VARCHAR(20) NOT NULL
    CHECK (category IN ('DOCUMENTATION','SOURCE_CODE','PHYSICAL_ASSET','ACCESS_KEY')),
  handover_to_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ
);

CREATE TABLE severance_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offboarding_request_id UUID UNIQUE NOT NULL
    REFERENCES offboarding_requests(id) ON DELETE CASCADE,
  service_years INT NOT NULL CHECK (service_years >= 0),
  base_salary DECIMAL(15,2) NOT NULL CHECK (base_salary >= 0),
  severance_pay DECIMAL(15,2) NOT NULL CHECK (severance_pay >= 0),
  service_appreciation_pay DECIMAL(15,2) NOT NULL CHECK (service_appreciation_pay >= 0),
  compensation_pay DECIMAL(15,2) NOT NULL CHECK (compensation_pay >= 0),
  dplk_topup_amount DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (dplk_topup_amount >= 0),
  total_disbursement DECIMAL(15,2) NOT NULL CHECK (total_disbursement >= 0),
  sla_disbursed_days INT CHECK (sla_disbursed_days >= 0),
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  payment_reference_no VARCHAR(100),
  paid_at TIMESTAMPTZ
);

CREATE TABLE lifetime_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  achievement_title VARCHAR(255) NOT NULL,
  achievement_type VARCHAR(20) NOT NULL
    CHECK (achievement_type IN ('PATENT','KAIZEN_SAVING','MENTORSHIP','REVENUE_IMPACT')),
  quantified_impact_idr DECIMAL(18,2) CHECK (quantified_impact_idr >= 0),
  points_awarded INT NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  date_achieved DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vmai_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES appraisal_periods(id) ON DELETE CASCADE,
  overall_vmai_score DECIMAL(5,2) NOT NULL CHECK (overall_vmai_score BETWEEN 0 AND 100),
  alignment_status VARCHAR(30) NOT NULL
    CHECK (alignment_status IN ('EXCEPTIONAL','ALIGNED','SUB_STANDARD','CRITICAL')),
  financial_pillar_score DECIMAL(5,2) NOT NULL CHECK (financial_pillar_score BETWEEN 0 AND 100),
  customer_pillar_score DECIMAL(5,2) NOT NULL CHECK (customer_pillar_score BETWEEN 0 AND 100),
  internal_pillar_score DECIMAL(5,2) NOT NULL CHECK (internal_pillar_score BETWEEN 0 AND 100),
  growth_pillar_score DECIMAL(5,2) NOT NULL CHECK (growth_pillar_score BETWEEN 0 AND 100),
  gcg_compliance_factor DECIMAL(3,2) NOT NULL DEFAULT 1.00
    CHECK (gcg_compliance_factor BETWEEN 0 AND 1),
  benchmark_deviation DECIMAL(5,2),
  generated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (period_id)
);

-- ============================ TATA KELOLA ============================
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action_type VARCHAR(30) NOT NULL
    CHECK (action_type IN ('CREATE','UPDATE','DELETE','CALIBRATE','DISBURSE',
                           'APPROVE','LOGIN','LOGOUT','UNLOCK')),
  entity_name VARCHAR(100) NOT NULL,
  record_id TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  description TEXT,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'audit_logs bersifat immutable: % ditolak pada baris % (PRD 6.2)',
    TG_OP, COALESCE(OLD.id::text, '?')
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE OR REPLACE FUNCTION unlock_appraisal(
  p_appraisal_id UUID,
  p_reason TEXT,
  p_actor_user_id UUID
) RETURNS VOID AS $$
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Alasan unlock wajib diisi minimal 10 karakter'
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM set_config('eperformiq.allow_appraisal_update', 'on', true);

  UPDATE performance_appraisals
     SET is_calibrated = FALSE, calibrated_by = NULL, calibrated_at = NULL
   WHERE id = p_appraisal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appraisal % tidak ditemukan', p_appraisal_id
      USING ERRCODE = 'no_data_found';
  END IF;

  INSERT INTO audit_logs (user_id, action_type, entity_name, record_id, description)
  VALUES (p_actor_user_id, 'UNLOCK', 'performance_appraisals',
          p_appraisal_id::text, p_reason);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_calibrated_appraisal_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_calibrated = TRUE
     AND current_setting('eperformiq.allow_appraisal_update', true)
         IS DISTINCT FROM 'on'
  THEN
    RAISE EXCEPTION
      'Nilai penilaian % telah disahkan dan bersifat immutable. Gunakan unlock_appraisal() dengan persetujuan Direktur HR (PRD 6.2).',
      OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_appraisal_immutable
  BEFORE UPDATE ON performance_appraisals
  FOR EACH ROW EXECUTE FUNCTION prevent_calibrated_appraisal_update();

-- ============================== INDEX ================================
CREATE INDEX idx_employees_manager ON employees(manager_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_department ON employees(department_id);
CREATE INDEX idx_individual_kpis_emp_period ON individual_kpis(employee_id, period_id);
CREATE INDEX idx_individual_kpis_status ON individual_kpis(status);
CREATE INDEX idx_individual_kpis_pillar ON individual_kpis(strategic_pillar_id);
CREATE INDEX idx_appraisals_period_gpa ON performance_appraisals(period_id, composite_gpa);
CREATE INDEX idx_appraisals_employee ON performance_appraisals(employee_id);
CREATE INDEX idx_audit_entity_record ON audit_logs(entity_name, record_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_division_kpis_corporate ON division_kpis(corporate_kpi_id);
CREATE INDEX idx_peer_reviews_evaluatee ON peer_reviews_360(evaluatee_id, period_id);
