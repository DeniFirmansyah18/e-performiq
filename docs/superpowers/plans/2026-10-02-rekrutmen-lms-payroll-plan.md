# Plan — Rekrutmen End-to-End + LMS + Payroll (E-PerformIQ)

> **Spec:** `docs/superpowers/specs/2026-10-02-rekrutmen-lms-payroll-design.md`
> **Tanggal:** 2026-10-02 · **Status:** DRAFT (untuk direview)
> **Pola:** workstream → task kecil (TDD, commit per task). Dijalankan bertahap; tiap WS bisa dirilis sendiri.
> **Test cmd:** `.\node_modules\.bin\vitest.cmd run <path>` · **Build:** `npm run build` · **DB reset:** `npm run db:reset`

Konvensi proyek: `ok/fail/problem` (`src/lib/api/response.ts`), `getAuthSession` (`@/lib/auth/getAuthSession`), `assertCan` (`@/lib/auth/rbac`), scope (`@/lib/auth/scope`), `db` singleton (driver-agnostic, `.execute()` ternormalisasi).

---

## Ringkasan Workstream & Urutan

| WS | Judul | Bergantung pada | Estimasi relatif |
|----|-------|-----------------|------------------|
| **WS-1** | Skema & migrasi rekrutmen + akun kandidat | — | kecil |
| **WS-2** | Login kandidat terpisah + RBAC `CANDIDATE` | WS-1 | sedang |
| **WS-3** | Daftar lowongan kandidat (kuota + status) | WS-2 | kecil |
| **WS-4** | Lamaran + upload resume + **ATS parsing + skor** | WS-3 | besar |
| **WS-5** | Timeline kandidat (auto-update) | WS-4 | sedang |
| **WS-6** | Mesin tes: psikometri (IPIP/CTT) + teknis (bank) + wawancara | WS-5 | besar |
| **WS-7** | Review HR + AI advisory + keputusan + notifikasi hasil | WS-6 | sedang |
| **WS-8** | LMS onboarding per-posisi + e-sertifikat | WS-7 | besar |
| **WS-9** | Absensi/timesheet (foto) | WS-7 | sedang |
| **WS-10** | Payroll (komponen lengkap + AI asistif) | WS-9 | besar |
| **WS-11** | Dashboard HR/Manager & pasca-kerja (agregasi) | WS-8..10 | sedang |

**Prinsip rilis:** setelah tiap WS selesai & tes hijau → commit + push (Vercel auto-deploy). Bisa berhenti di WS mana pun dan tetap aplikasi utuh.

---

## WS-1 — Skema & Migrasi

**Files:**
- Create: `src/lib/db/migrations/0011_recruitment_accounts.sql`
- Create: `src/lib/db/migrations/0012_assessment_engine.sql`
- Create: `src/lib/db/migrations/0013_payroll.sql`
- Test: `tests/integration/recruitment-schema.test.ts`

**Isi migrasi (ringkas):**
- `candidate_accounts` (id, email UNIQUE, password_hash, full_name, phone, is_verified, created_at).
- Perluas `candidates`: `account_id` (FK), `source`.
- `candidate_profiles`, `candidate_skills`, `candidate_educations`, `candidate_experiences`.
- `resume_parses` (application_id, raw_text, parsed_json JSONB, ats_score, provider).
- `application_timeline` (application_id, stage, status, note, created_at).
- Enums: `assessment_type_enum`, `assessment_status_enum`, `timeline_stage_enum`, `timeline_status_enum`.
- `assessment_templates`, `assessment_questions`, `assessment_attempts`, `assessment_responses`.
- `interview_schedules` (perluas via tabel baru: application_id, link, interviewer_id, score).
- `position_courses`.
- `payroll_runs`, `payroll_items`, `payroll_components`.
- Perluas `attendance_records` (photos JSONB) & `daily_timesheets` (photos JSONB) via `ALTER TABLE IF NOT EXISTS`-style guard.

**Steps:**
1. Tulis tes skema (harapan: tabel & enum ada; `schema.test` jumlah tabel bertambah).
2. Buat migrasi idempoten (`CREATE TABLE IF NOT EXISTS`, `DO $$ ... $$` untuk enum).
3. `npm run db:reset` → `vitest run tests/integration/recruitment-schema.test.ts`.
4. Update `tests/integration/schema.test.ts` (jumlah tabel/enum baru).
5. Commit: `feat(db): recruitment+candidate account, assessment & payroll schema`.

---

## WS-2 — Login Kandidat Terpisah + RBAC

**Files:**
- Modify: `src/lib/auth/rbac.ts` (tambah peran `CANDIDATE`).
- Create: `src/lib/auth/candidateSession.ts` (sign/verify, cookie `eperformiq_candidate_token`).
- Create: `src/app/api/v1/careers/auth/register/route.ts`, `.../login/route.ts`, `.../me/route.ts`.
- Create: `src/app/careers/login/page.tsx`, `src/app/careers/register/page.tsx`.
- Test: `tests/api/candidate-auth.test.ts`

**Steps (TDD):**
1. Tes: register (email unik), login (token cookie terpisah), me (401 tanpa token).
2. Implementasi routes + session.
3. Halaman login/register kandidat (UI terpisah dari `/login`).
4. `vitest run tests/api/candidate-auth.test.ts` → hijau.
5. Commit: `feat(careers): separate candidate auth (register/login/me) + CANDIDATE role`.

---

## WS-3 — Daftar Lowongan Kandidat

**Files:** Modify `src/app/api/v1/careers/postings/route.ts`; Create `src/app/careers/page.tsx` (perluas) + komponen kartu lowongan.
**Steps:** endpoint kembalikan kualifikasi + kuota tersisa + status; UI daftar + filter; tes API; commit.

---

## WS-4 — Lamaran + Upload + ATS (paling berat)

**Files:**
- Create: `src/lib/services/atsService.ts` (ekstraksi teks PDF/DOCX → parsing → skor).
- Create: `src/lib/services/resumeParser.ts` (regex + heuristik; fallback AI `aiService`).
- Modify: `src/app/api/v1/careers/apply/route.ts` (terima file/URL resume, jalankan ATS, simpan).
- Create: `src/app/api/v1/careers/upload/route.ts` (upload resume).
- Create: UI form lamaran di `/careers` + upload.
- Test: `tests/integration/atsService.test.ts`, `tests/api/careers-apply-ats.test.ts`.

**Catatan teknis:** PDF/DOCX parsing lib (mis. `pdf-parse`, `mammoth`) — evaluasi & tambahkan dependensi. Bila tak ada, fallback AI ekstraksi terstruktur.
**Steps:** tes skor ATS (match skill), parsing sample, UI, commit.

---

## WS-5 — Timeline Kandidat

**Files:** Create `src/lib/services/timelineService.ts` + `src/app/api/v1/careers/timeline/route.ts` + UI di `/careers/status`.
**Steps:** service update tahap; endpoint GET; UI timeline; tes; commit.

---

## WS-6 — Mesin Tes

**Files:**
- Create: `src/lib/services/assessmentService.ts` (buat attempt, submit, skor CTT).
- Create: `src/lib/db/seed/assessment-seed.ts` (IPIP subset + bank teknis dari HumanEval/MBPP/MMLU bila memungkinkan).
- Create: routes `src/app/api/v1/careers/assessments/{start,submit,get}/route.ts`.
- Create: UI tes di portal kandidat.
- Create: routes HR untuk jadwal wawancara + input skor.
- Test: `tests/integration/assessmentService.test.ts`.

**Pendekatan skoring:** CTT (Likert untuk IPIP; benar/salah untuk teknis). Simpan respon per-item.
**Steps:** IPIP subset (mis. 20–50 item) → seed; MCQ teknis contoh; hitung skor berbobot 30/40/30; UI; commit.

---

## WS-7 — Review HR + AI + Keputusan

**Files:** Create `src/lib/services/candidateReviewService.ts` (agregasi skor + prompt AI) + routes `/api/v1/recruitment/candidates/[id]/review` & `/decision`; UI di `hr-command`.
**Steps:** agregasi skor; AI ringkasan (pakai `aiService`, fallback aman); HR decision; update timeline; commit.

---

## WS-8 — LMS Onboarding per-Posisi + e-Sertifikat

**Files:** Create `position_courses` seed; `src/lib/services/onboardingService.ts`; perluas `learning` services & UI; auto-issue sertifikat saat tuntas.
**Steps:** petakan posisi→kursus (dari katalog OSS §5.1, simpan link+metadata); learning plan otomatis untuk karyawan baru; tes; commit.

---

## WS-9 — Absensi/Timesheet (Foto)

**Files:** Modify `productivityService.ts` + routes; UI portal karyawan (upload foto).
**Steps:** perluas skema; endpoint submit with photo URL; approval; tes; commit.

---

## WS-10 — Payroll

**Files:** Create `src/lib/services/payrollService.ts` (komponen: pokok, tunjangan, lembur, bonus, THR, BPJS, PPh21, pro-rata); routes HR; UI HR + slip karyawan.
**Steps:** formula deterministik + tes unit (berbagai kasus); AI ringkasan/anomali (advisory); ekspor; commit.

---

## WS-11 — Dashboard & Pasca-Kerja

**Files:** agregasi ke dashboard HR/Manager; perluas pasca-kerja (cuti/LCI/exit).
**Steps:** endpoint agregasi; kartu dashboard; tes; commit.

---

## Review Focus (risiko yang harus diuji tiap WS)
1. **Isolasi sesi** kandidat vs karyawan (tidak boleh bocor akses).
2. **ATS** tidak boleh crash bila resume tak terparse → fallback AI/empty.
3. **Skor tes** konsisten dengan bobot 30/40/30.
4. **AI advisory** tidak memblokir keputusan manusia; fallback bila provider mati.
5. **Payroll** deterministik (uji batas: pro-rata, THR, lembur).
6. **Migrasi idempoten** (aman diulang; `db:reset` hijau).
7. **Driver-agnostic** (PGlite lokal & Postgres produksi).

---

## Cara Eksekusi
1. Review spec & plan ini (Anda).
2. Setujui urutan & cakupan awal (saran: mulai **WS-1 + WS-2 + WS-3**).
3. Saya eksekusi per WS (TDD), commit + push tiap selesai.
