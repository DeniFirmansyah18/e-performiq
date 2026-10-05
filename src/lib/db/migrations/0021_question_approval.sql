-- 0021_question_approval.sql — gerbang persetujuan soal AI (WS-4).
-- Soal hasil generate AI masuk sebagai DRAFT (is_active = FALSE) dan baru
-- terlihat kandidat setelah HR menyetujui (is_active = TRUE).
-- Idempoten (ADR 003): seluruh pernyataan memakai IF NOT EXISTS / guard.
ALTER TABLE assessment_questions ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE assessment_questions ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE assessment_questions ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE assessment_questions ADD COLUMN IF NOT EXISTS rejection_note TEXT;
ALTER TABLE assessment_questions ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20);
ALTER TABLE assessment_questions ADD COLUMN IF NOT EXISTS skill_tag VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_assessment_questions_active
  ON assessment_questions(template_id, is_active);

-- Backfill: soal lama (seed) dianggap sudah disetujui.
UPDATE assessment_questions SET is_active = TRUE WHERE is_active IS NULL;
