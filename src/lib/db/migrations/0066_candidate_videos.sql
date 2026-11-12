-- 0066: Video perkenalan diri kandidat (unjuk spesialisasi).
--
-- Biner video TIDAK disimpan di tabel ini; yang disimpan hanya lokasi berkas
-- pada penyimpanan objek/lokal. Menyimpan biner di database membuat ukuran DB
-- membengkak dan query lambat.
--
-- Baris di sini dihapus otomatis (bersama berkasnya) ketika lamaran mencapai
-- status final HIRED atau REJECTED, agar penyimpanan tidak penuh.
CREATE TABLE IF NOT EXISTS candidate_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  application_id UUID REFERENCES job_applications(id) ON DELETE SET NULL,
  storage_key TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL DEFAULT 'video/mp4',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  duration_seconds NUMERIC(8,2),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_candidate_videos_candidate ON candidate_videos (candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_videos_application ON candidate_videos (application_id);
