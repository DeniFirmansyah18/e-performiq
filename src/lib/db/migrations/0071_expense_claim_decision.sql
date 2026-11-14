-- Keputusan klaim reimbursement oleh HR/Finance.
--
-- Sebelumnya `expense_claims` hanya punya status SUBMITTED/APPROVED/PAID/REJECTED
-- dan `processed_at`, tetapi TIDAK menyimpan SIAPA yang memutuskan maupun
-- ALASAN penolakan. Tanpa jejak itu klaim tidak dapat dipertanggungjawabkan.
ALTER TABLE expense_claims
  ADD COLUMN IF NOT EXISTS decided_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE expense_claims
  ADD COLUMN IF NOT EXISTS decision_note TEXT;

-- Nominal yang disetujui boleh berbeda dari yang diajukan (mis. klaim sebagian).
ALTER TABLE expense_claims
  ADD COLUMN IF NOT EXISTS approved_amount DECIMAL(15,2);

-- Catatan: status memakai kolom `status` yang sudah ada.
CREATE INDEX IF NOT EXISTS idx_expense_claims_status
  ON expense_claims (status, claim_date DESC);
