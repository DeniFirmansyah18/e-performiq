# Rencana Implementasi: Integrasi Lifecycle End-to-End (PRE → DURING → POST)

**Tanggal:** 2026-10-07
**Tujuan:** Menutup 8 gap integrasi agar sistem layak produksi end-to-end.
**Prinsip:** setiap tahap = (migrasi bila perlu) + service/repo + route/UI + TES. Tidak ada tahap yang di-commit tanpa tes hijau + build OK.
**Aturan verifikasi:** jalankan `npm run db:migrate` bila ada migrasi baru; `npm run db:reset` sebelum suite route (dev .pglite dipakai bersama).

---

## Tahap 1 — Offboarding write-back + state machine (risiko tertinggi)

**Gap:** `employees.status`/`last_working_day` tidak pernah ditulis saat offboarding selesai; `offboarding_requests.status` mandek di `INITIATED`.

**Desain:**
- State machine: `INITIATED → CLEARANCE_IN_PROGRESS → COMPLETED` (+ `DISPUTED` sudah ada di enum).
- `CLEARANCE_IN_PROGRESS` otomatis saat ada verifikasi handover pertama.
- `COMPLETED` otomatis saat semua handover tervalidasi **dan** pesangon dibayar; saat transisi ke COMPLETED → `UPDATE employees SET status='RESIGNED'|'RETIRED', last_working_day=<LWD>`, lalu nonaktifkan `users.is_active=false`.
- Reason `PENSION` → `RETIRED`; lainnya → `RESIGNED`.

**Perubahan:**
1. `src/lib/repositories/offboardingRepository.ts`
   - `updateOffboardingStatus(db, id, status)`.
   - `selectHandoverProgress(db, requestId)` (verified/total).
   - `deactivateEmployee(db, employeeId, status, lastWorkingDay)` — 1 transaksi: update employee + `users.is_active=false`.
2. `src/lib/services/offboardingService.ts`
   - `verifyHandoverItem()` → setelah verifikasi, panggil rekalkulasi status: bila ada handover verified & belum semua → `CLEARANCE_IN_PROGRESS`.
   - `disburseSeverance()` → setelah `markSeverancePaid`, bila semua handover verified → set `COMPLETED` + write-back employee.
   - Tambah guard idempoten (jangan double-deactivate).
3. Tanpa migrasi baru (enum sudah punya `CLEARANCE_IN_PROGRESS`/`COMPLETED`).

**Tes:** `tests/integration/offboardingLifecycle.test.ts` (baru)
- verifikasi pertama → status `CLEARANCE_IN_PROGRESS`.
- disburse sebelum semua handover verified DITOLAK (sudah ada gate di severance; tambah untuk transisi).
- semua verified + disburse → status `COMPLETED`, employee `RESIGNED`, `last_working_day` terisi, `users.is_active=false`.
- idempoten: dijalankan 2x tidak mengubah apa pun.

---

## Tahap 2 — Pesangon → Payroll (final settlement)

**Gap:** pesangon tidak masuk `payroll_items`/slip gaji.

**Desain:**
- Migrasi `0026_payroll_final_settlement.sql`: tambah `payroll_runs.run_type` (`'REGULAR'|'FINAL_SETTLEMENT'`, default `REGULAR`) + kolom `payroll_items.severance`, `payroll_items.dplk_topup`.
- Service `generateFinalSettlementRun(db, { offboardingRequestId, periodCode, createdBy })`:
  - Gate: handover semua verified (PRD §8) + severance sudah dihitung.
  - Buat 1 `payroll_runs` (`run_type='FINAL_SETTLEMENT'`, period unik `YYYY-MM-FS-<empcode>`), 1 `payroll_items` dengan `severance`, `dplk_topup`, `base_salary=0`, dst.; `total_net = severance + dplk_topup`.
- Slip gaji: `payrollService` slip harus menampilkan komponen severance bila `run_type='FINAL_SETTLEMENT'`.

**Perubahan:**
1. Migrasi `0026_payroll_final_settlement.sql` (aditif, idempoten).
2. `src/lib/services/payrollService.ts` → `generateFinalSettlementRun`.
3. `src/app/api/v1/payroll/runs/route.ts` (POST) → dukung `mode:'FINAL_SETTLEMENT' + offboarding_request_id`.
4. `src/app/api/v1/payroll/payslip/route.ts` → sertakan severance/dplk.

**Tes:** `tests/api/payroll-final-settlement.test.ts` (baru)
- FS run ditolak bila handover belum verified.
- FS run dibuat dengan komponen severance benar; total_net = severance + dplk.
- slip gaji FS memuat severance.

---

## Tahap 3 — Clearance gate (verifikasi & perkuat)

**Gap:** sudah ada gate di `calculateOffboardingSeverance`; yang kurang = gate pada transisi status + cetak slip.

**Perubahan:** pastikan Tahap 1 & 2 memakai gate yang sama (single helper `assertClearanceComplete`). Tes: tidak ada FS/status COMPLETED bila checklist belum tuntas.

---

## Tahap 4 — UI evaluasi probation (manager-cockpit)

**Gap:** endpoint `PUT /api/v1/pre-employment/probation/[id]` tidak dipanggil UI.

**Perubahan:**
1. `src/app/dashboard/manager-cockpit/page.tsx`: ganti blok statis "30-60-90 Days Probation Review" → form live: muat daftar probation (`GET /api/v1/pre-employment/probation` — **tambah handler GET** bila belum ada), input day_30/60/90 + notes + `probation_passed` + `conversion_date`, submit ke `PUT`.
2. Tambah GET di `src/app/api/v1/pre-employment/probation/route.ts` (list) dan pastikan `[id]` PUT ada (sudah).

**Tes:** `tests/api/probation-evaluation.test.ts` (baru)
- GET list probation (HR).
- PUT menandai lulus → employee jadi PERMANENT + `conversion_date` set.
- RBAC: ASSESSOR tidak bisa PUT.

---

## Tahap 5 — Auto-assign KPI & periode appraisal saat masuk

**Gap:** karyawan baru tanpa KPI; handoff manual.

**Desain:**
- Saat `candidateConversionService.convertHiredCandidate()` dan `preEmploymentRepository` probation-pass (konversi ke PERMANENT), panggil `seedOnboardingKpis(db, employeeId, periodId?)`:
  - Pastikan ada `appraisal_periods` ACTIVE (buat `YYYY-ANNUAL` bila belum ada).
  - Buat 3 KPI template standar (bobot 50/30/20) tertaut pilar strategis default (pilar pertama per perspektif) — draf `DRAFT`, sehingga HR/manager menyesuaikan.
- Idempoten (skip bila sudah ada KPI di periode itu).

**Perubahan:**
1. `src/lib/services/kpiService.ts` → `seedStarterKpis(db, employeeId, periodId)`.
2. `src/lib/services/appraisalService.ts` → `ensureActiveAppraisalPeriod(db)`.
3. Hook di `candidateConversionService` (idempoten).

**Tes:** `tests/integration/kpi-autoseed.test.ts` (baru)
- konversi kandidat → KPI starter terbuat, total bobot ≤ 100, tertaut pilar.
- idempoten: konversi 2x tidak menduplikasi.

---

## Tahap 6 — Notifikasi lifecycle karyawan

**Gap:** notifikasi hanya kandidat.

**Desain:** tambah fungsi employee-facing di `notificationService.ts` (`notifyEmployeeLifecycle(db, employeeId, event)`), menulis ke `email_outbox` + `whatsappService` (best-effort). Event: `HIRED_ONBOARDING`, `PROBATION_PASSED`, `OFFBOARDING_INITIATED`, `SEVERANCE_PAID`.

**Perubahan:**
1. `src/lib/services/notificationService.ts` → 4 fungsi.
2. Panggil di: `candidateConversionService` (hired), `preEmploymentService.evaluateProbationMilestone` (passed), `offboardingService.createOffboardingRequest` (initiated) & `disburseSeverance` (paid).

**Tes:** `tests/integration/lifecycle-notifications.test.ts` (baru)
- tiap event menulis 1 baris outbox dengan tipe benar.
- best-effort: gagal kirim tidak melempar (mock throw → tetap 200).

---

## Tahap 7 — GCG compliance factor + VMAI actual

**Gap:** `gcgComplianceFactor` hardcoded `1.0`; `VMAI_TARGET.actual=0`.

**Desain:**
- Hitung `gcgComplianceFactor` dari temuan audit: `1 - min(0.5, fatalFindings*0.1)` (fatal audit finding menurunkan maksimum 50%).
- `getBenchmarkGap` → `VMAI_TARGET.actual` = nilai VMAI dari `analyticsService.getVmaiScorecardData`.

**Perubahan:**
1. `src/lib/services/analyticsService.ts` → hitung factor dari data (tabel audit findings / sop_compliance_logs).
2. `src/lib/services/analyticsSummaryService.ts` → actual VMAI real.

**Tes:** `tests/api/analytics-gcg-vmai.test.ts` (baru)
- tanpa temuan → factor 1.0; dengan temuan fatal → factor < 1.0, VMAI turun.
- benchmark-gap `VMAI_TARGET.actual` = nilai scorecard.

---

## Tahap 8 — Perbaiki scope ASSESSOR

**Gap:** ASSESSOR `ORG_WIDE` + `profile:write`.

**Desain:**
- Cabut `ASSESSOR` dari `ORG_WIDE_ROLES` (jadi hanya SUPER_ADMIN, BOD, HR_MANAGER, AUDITOR).
- ASSESSOR ter-scope ke **kandidat/karyawan yang ditugaskan** (via `recruitment_assessments`/interview assignment) — untuk scope karyawan, batasi ke departemen yang relevan atau daftar kosong (hanya data kandidat).
- Cabut `ASSESSOR` dari `profile:write`.

**Perubahan:**
1. `src/lib/auth/scope.ts` → `ORG_WIDE_ROLES` tanpa ASSESSOR; tambah cabang ASSESSOR.
2. `src/lib/auth/rbac.ts` → `profile:write` tanpa ASSESSOR.

**Tes:** `tests/api/assessor-scope.test.ts` (baru)
- ASSESSOR tidak bisa `profile:write` (403).
- ASSESSOR tidak melihat karyawan di luar scope.

---

## Validasi akhir
- `npm run db:migrate` (0066) lalu `npm run db:reset`.
- Jalankan seluruh suite tes + `npm run build`.
- Tidak commit/push.
