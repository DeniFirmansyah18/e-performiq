-- 0047: Tangga karir terukur (PRD v2.0 §5.7, §10.3 D).
DO $$ BEGIN CREATE TYPE career_requirement_enum AS ENUM
  ('GPA', 'COMPETENCY', 'CERTIFICATION', 'TRAINING_HOURS', 'MOODLE_COURSE', 'TENURE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS career_ladder_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_position_id UUID NOT NULL REFERENCES job_positions(id) ON DELETE CASCADE,
  to_position_id UUID NOT NULL REFERENCES job_positions(id) ON DELETE CASCADE,
  step_order SMALLINT NOT NULL CHECK (step_order > 0),
  step_name VARCHAR(200) NOT NULL,
  requirement_type career_requirement_enum NOT NULL,
  requirement_ref VARCHAR(200),
  threshold_value DECIMAL(10,2),
  is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (from_position_id, to_position_id, step_order),
  CHECK (from_position_id <> to_position_id)
);

CREATE INDEX IF NOT EXISTS idx_career_ladder_target
  ON career_ladder_steps (from_position_id, to_position_id, step_order);
