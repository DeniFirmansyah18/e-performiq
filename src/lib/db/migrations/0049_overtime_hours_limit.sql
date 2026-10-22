-- 0049: Batas jam lembur berbeda untuk hari kerja (4) dan hari libur (10).
-- Constraint 0043 hanya mengenal satu batas; validasi per jenis hari kini
-- ditegakkan di overtimeService (butuh kalender hari libur).
ALTER TABLE overtime_requests DROP CONSTRAINT IF EXISTS overtime_requests_planned_hours_check;
ALTER TABLE overtime_requests
  ADD CONSTRAINT overtime_requests_planned_hours_check
  CHECK (planned_hours > 0 AND planned_hours <= 10);
