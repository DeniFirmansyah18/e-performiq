-- 0068: Alur persetujuan MPP (HR mengajukan → BOD memutuskan).
--
-- Sebelumnya manpower_plans tidak punya status: setiap baris langsung
-- dianggap sah. Sekarang pengajuan baru dari HR masuk antrean PENDING dan
-- baru berlaku setelah BOD menyetujui.
--
-- Data lama SENGAJA diisi 'APPROVED' agar rekrutmen yang sedang berjalan tidak
-- ikut terblokir; hanya pengajuan baru yang melewati persetujuan.
DO $$ BEGIN CREATE TYPE mpp_status_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE manpower_plans
  ADD COLUMN IF NOT EXISTS status mpp_status_enum NOT NULL DEFAULT 'APPROVED';

-- Atasan langsung (People Manager) yang memantau pegawai pada formasi ini.
ALTER TABLE manpower_plans
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES employees(id) ON DELETE SET NULL;

-- Jejak pengajuan & keputusan.
ALTER TABLE manpower_plans
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE manpower_plans
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE manpower_plans
  ADD COLUMN IF NOT EXISTS decided_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE manpower_plans
  ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;
ALTER TABLE manpower_plans
  ADD COLUMN IF NOT EXISTS decision_note TEXT;

CREATE INDEX IF NOT EXISTS idx_manpower_plans_status
  ON manpower_plans (status) WHERE status = 'PENDING';
