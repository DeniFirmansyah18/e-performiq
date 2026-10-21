-- 0039: Feed aktivitas terpadu (PRD v2.0 §5.11, §10.3 F).
DO $$ BEGIN CREATE TYPE activity_event_type_enum AS ENUM
  ('ATTENDANCE', 'KPI_DAILY', 'DPI_STATUS', 'LEAVE', 'OVERTIME',
   'TRAINING', 'LETTER', 'DISCIPLINARY', 'RECOGNITION', 'CAREER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  event_type activity_event_type_enum NOT NULL,
  entity_id UUID,
  summary VARCHAR(255) NOT NULL,
  visibility VARCHAR(20) NOT NULL DEFAULT 'INTERNAL'
    CHECK (visibility IN ('INTERNAL', 'CONFIDENTIAL', 'RESTRICTED')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_feed
  ON activity_events (employee_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_visibility
  ON activity_events (visibility, occurred_at DESC);
