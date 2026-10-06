-- 0024: evaluasi wawancara terstruktur (rubrik) oleh HR.
--
-- Sebelumnya skor wawancara hanya satu angka (`interview_schedules.score`).
-- Tabel ini menyimpan rubrik 7 kriteria (skala 1..5) + catatan agar penilaian
-- konsisten & dapat dianalisis otomatis. `composite_score` = rata-rata kriteria
-- yang dikonversi ke 0..100 (feeding `setInterviewScore`).

CREATE TABLE IF NOT EXISTS interview_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  interview_id UUID REFERENCES interview_schedules(id) ON DELETE SET NULL,
  evaluator_user_id UUID REFERENCES users(id),
  -- Rubrik per kriteria (1..5; NULL = tidak dinilai).
  technical_skill INT,
  problem_solving INT,
  communication INT,
  collaboration INT,
  motivation INT,
  leadership INT,
  professionalism INT,
  -- Hasil turunan (0..100) + catatan kualitatif.
  composite_score NUMERIC(5,2),
  strengths TEXT,
  concerns TEXT,
  notes TEXT,
  recommendation VARCHAR(20), -- STRONG_HIRE | HIRE | CONSIDER | NO_HIRE
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (application_id)
);
