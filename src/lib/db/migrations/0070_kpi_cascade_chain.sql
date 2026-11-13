-- Rantai KPI berjenjang: BOD -> HR -> People Manager -> Posisi -> Pegawai.
--
-- Sebelumnya `division_kpis` hanya terhubung ke DEPARTEMEN, sehingga target
-- perusahaan tidak dapat ditelusuri sampai ke posisi maupun ke People Manager
-- secara eksplisit. Migrasi ini menambahkan jembatan yang hilang.
--
-- Rantai lengkap setelah migrasi:
--   strategic_pillars -> corporate_kpis -> division_kpis
--     -> manager_kpis (People Manager per departemen)
--     -> position_kpis (per posisi)
--     -> individual_kpis (per pegawai)

-- ===== KPI tingkat People Manager =====
CREATE TABLE IF NOT EXISTS manager_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_kpi_id UUID NOT NULL REFERENCES division_kpis(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  kpi_title VARCHAR(255) NOT NULL,
  target_value DECIMAL(12,2) NOT NULL CHECK (target_value > 0),
  unit_of_measure VARCHAR(50) NOT NULL DEFAULT '%',
  weight_pct DECIMAL(5,2) NOT NULL CHECK (weight_pct > 0 AND weight_pct <= 100),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_manager_kpis_division ON manager_kpis(division_kpi_id);
CREATE INDEX IF NOT EXISTS idx_manager_kpis_employee ON manager_kpis(employee_id);

-- Satu People Manager tidak boleh punya dua KPI berjudul sama dalam satu divisi.
CREATE UNIQUE INDEX IF NOT EXISTS uq_manager_kpis_unik
  ON manager_kpis(division_kpi_id, employee_id, kpi_title);

-- ===== KPI tingkat Posisi =====
CREATE TABLE IF NOT EXISTS position_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_kpi_id UUID REFERENCES manager_kpis(id) ON DELETE SET NULL,
  position_id UUID NOT NULL REFERENCES job_positions(id) ON DELETE CASCADE,
  kpi_title VARCHAR(255) NOT NULL,
  target_value DECIMAL(12,2) NOT NULL CHECK (target_value > 0),
  unit_of_measure VARCHAR(50) NOT NULL DEFAULT '%',
  weight_pct DECIMAL(5,2) NOT NULL CHECK (weight_pct > 0 AND weight_pct <= 100),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_position_kpis_position ON position_kpis(position_id);
CREATE INDEX IF NOT EXISTS idx_position_kpis_manager ON position_kpis(manager_kpi_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_position_kpis_unik
  ON position_kpis(position_id, kpi_title);

-- ===== Penautan KPI individu ke tingkat posisi =====
-- NULL berarti KPI individu belum diturunkan dari KPI posisi (rantai putus).
ALTER TABLE individual_kpis
  ADD COLUMN IF NOT EXISTS position_kpi_id UUID REFERENCES position_kpis(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_individual_kpis_position_kpi
  ON individual_kpis(position_kpi_id);

-- ===== Riwayat penetapan KPI berjenjang =====
-- Mencatat siapa menurunkan KPI apa ke tingkat mana, sehingga alur BOD -> HR
-- -> People Manager -> Pegawai dapat diaudit.
CREATE TABLE IF NOT EXISTS kpi_cascade_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tingkat_dari VARCHAR(20) NOT NULL,
  tingkat_ke VARCHAR(20) NOT NULL,
  kode_sumber VARCHAR(120) NOT NULL,
  kode_hasil VARCHAR(120) NOT NULL,
  dilakukan_oleh UUID REFERENCES users(id) ON DELETE SET NULL,
  sumber_ai BOOLEAN NOT NULL DEFAULT FALSE,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_kpi_cascade_log_waktu ON kpi_cascade_log(created_at DESC);
