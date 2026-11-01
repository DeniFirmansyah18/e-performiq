-- Kolom pelaku (verified_by, cleared_by, issued_by, completed_by) menyimpan
-- `users.id` dari sesi, bukan `employees.id`. Perbaiki foreign key agar konsisten
-- dengan konvensi tabel lain (mis. employee_documents.verified_by).

ALTER TABLE clearance_assets
  DROP CONSTRAINT IF EXISTS clearance_assets_verified_by_fkey;
ALTER TABLE clearance_assets
  ADD CONSTRAINT clearance_assets_verified_by_fkey
  FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE clearance_signoffs
  DROP CONSTRAINT IF EXISTS clearance_signoffs_cleared_by_fkey;
ALTER TABLE clearance_signoffs
  ADD CONSTRAINT clearance_signoffs_cleared_by_fkey
  FOREIGN KEY (cleared_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE service_letters
  DROP CONSTRAINT IF EXISTS service_letters_issued_by_fkey;
ALTER TABLE service_letters
  ADD CONSTRAINT service_letters_issued_by_fkey
  FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE post_employment_obligations
  DROP CONSTRAINT IF EXISTS post_employment_obligations_completed_by_fkey;
ALTER TABLE post_employment_obligations
  ADD CONSTRAINT post_employment_obligations_completed_by_fkey
  FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL;
