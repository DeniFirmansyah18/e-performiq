-- 0020_irt_parameters.sql — parameter tebakan semu IRT (3PL) untuk bank soal.
ALTER TABLE assessment_questions ADD COLUMN IF NOT EXISTS irt_c NUMERIC(6,3);
