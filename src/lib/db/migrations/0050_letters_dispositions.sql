-- 0050: e-Surat, disposisi berjenjang (PRD v2.0 §5.8, §10.3 E).
DO $$ BEGIN CREATE TYPE letter_direction_enum AS ENUM ('INCOMING', 'OUTGOING', 'DIRECTIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE letter_classification_enum AS ENUM ('BIASA', 'TERBATAS', 'RAHASIA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE letter_status_enum AS ENUM ('DRAFT', 'OPEN', 'IN_PROGRESS', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE disposition_status_enum AS ENUM
  ('BELUM_DIBACA', 'DIBACA', 'DIKERJAKAN', 'SELESAI', 'DITOLAK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_number VARCHAR(60) NOT NULL UNIQUE,
  direction letter_direction_enum NOT NULL,
  classification letter_classification_enum NOT NULL DEFAULT 'BIASA',
  subject VARCHAR(255) NOT NULL,
  sender VARCHAR(200),
  recipient VARCHAR(200),
  letter_date DATE NOT NULL,
  received_date DATE,
  file_url TEXT,
  status letter_status_enum NOT NULL DEFAULT 'DRAFT',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS letter_dispositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id UUID NOT NULL REFERENCES letters(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  instruction TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL'
    CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  due_date DATE,
  status disposition_status_enum NOT NULL DEFAULT 'BELUM_DIBACA',
  read_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completion_note TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CHECK (from_user_id <> to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_disposition_inbox
  ON letter_dispositions (to_user_id, status, due_date);
