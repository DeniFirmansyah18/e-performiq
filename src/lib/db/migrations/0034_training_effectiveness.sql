-- 0034: Efektivitas pelatihan (Kirkpatrick L2/L3) — skor pre/post test (PRD §3.2: delta ≥ +25%).
-- Kolom aditif pada enrollment. Idempotent (ADR 003).

ALTER TABLE moodle_course_enrollments ADD COLUMN IF NOT EXISTS pre_test_score DECIMAL(5,2)
  CHECK (pre_test_score BETWEEN 0 AND 100);
ALTER TABLE moodle_course_enrollments ADD COLUMN IF NOT EXISTS post_test_score DECIMAL(5,2)
  CHECK (post_test_score BETWEEN 0 AND 100);
