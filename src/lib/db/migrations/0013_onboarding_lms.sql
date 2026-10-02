-- 0013: Onboarding LMS per-posisi — pemetaan posisi→kursus + program onboarding karyawan baru.
-- Idempotent (ADR 003). Selaras spec: docs/superpowers/specs/2026-10-02-rekrutmen-lms-payroll-design.md §3 (B1-B3).

DO $$ BEGIN CREATE TYPE onboarding_status_enum AS ENUM ('IN_PROGRESS','COMPLETED','WAIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- B1. Kurikulum per posisi: posisi → kursus wajib/opsional
-- ============================================================
CREATE TABLE IF NOT EXISTS position_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID NOT NULL REFERENCES job_positions(id) ON DELETE CASCADE,
  course_id INT NOT NULL REFERENCES moodle_courses(id) ON DELETE CASCADE,
  is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
  order_index INT NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (position_id, course_id)
);

-- ============================================================
-- B2. Program onboarding karyawan baru (per karyawan)
-- ============================================================
CREATE TABLE IF NOT EXISTS onboarding_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
  application_id UUID REFERENCES job_applications(id) ON DELETE SET NULL,
  position_id UUID REFERENCES job_positions(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES learning_plans(id) ON DELETE SET NULL,
  status onboarding_status_enum NOT NULL DEFAULT 'IN_PROGRESS',
  started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ
);
