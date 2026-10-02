# WS-0 — Audit & Hardening Integrasi Produksi (E-PerformIQ)

> **Tanggal:** 2026-10-02 · **Status:** IN PROGRESS
> **Tujuan:** memastikan aplikasi **bukan demo** — semua fitur baca/tulis data nyata & saling terintegrasi lintas peran.

---

## 0.1 Matriks Fitur × Role

**Sumber gating:** `middleware.ts` (`DASHBOARD_ROLES`) + RBAC (`src/lib/auth/rbac.ts`) + scope (`scope.ts`).

| Segmen Dashboard | BOD | HR_MGR | PEOPLE_MGR | EMPLOYEE | AUDITOR | SUPER_ADMIN | ASSESSOR |
|------------------|:---:|:------:|:----------:|:--------:|:-------:|:-----------:|:--------:|
| `/dashboard/executive` | ✅ | — | — | — | ✅ | ✅ | ✅ |
| `/dashboard/hr-command` | ✅ | ✅ | — | — | — | ✅ | ✅ |
| `/dashboard/manager-cockpit` | — | ✅ | ✅ | — | — | ✅ | ✅ |
| `/dashboard/employee-portal` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/dashboard/ninebox-matrix` | ✅ | ✅ | ✅ | — | — | ✅ | ✅ |
| `/dashboard/audit-governance` | ✅ | ✅ | — | — | ✅ | ✅ | ✅ |

**Catatan:** `EMPLOYEE` **hanya** punya `/dashboard/employee-portal` — sebagai portal pribadi (self-service). Role lain (BOD/HR/Auditor/Assessor) bisa melihat portal karyawan (untuk inspeksi), wajar.

| Fitur (domain API) | Real DB? | Endpoint | Status |
|--------------------|:--------:|----------|:------:|
| Profil karyawan (self-service) | ✅ | `/api/v1/profile/me` | OK |
| KPI individu (CRUD/approval/bobot/evidence) | ✅ | `/api/v1/performance/*` | OK |
| GPA/appraisal + kalibrasi | ✅ | `/appraisals/calculate-gpa`, `/appraisals/:id/calibrate` | OK |
| 9-Box & talent | ✅ | `/performance/nine-box-summary` | OK |
| 360° & core values | ✅ | `/performance/360-reviews` | OK |
| Absensi & timesheet | ✅ | `/attendance`, `/performance/timesheets` | OK |
| Payroll & payslip | ✅ | `/finance/*` | OK |
| LMS / kursus / sertifikat | ✅ | `/learning/*`, `/certificates/*` | OK |
| Rekrutmen & kandidat | ✅ | `/recruitment/*`, `/careers/*` | OK |
| Analytics/VMAI | ✅ | `/analytics/*` | OK |
| Governance/audit | ✅ | `/governance/*` | OK |
| AI (multi-provider) | ✅ | `/ai/*` | OK |

**Kesimpulan:** fondasi fitur **nyata & terpusat data DB**, bukan dummy bisnis.

---

## 0.2 Residu Demo (yang harus dibersihkan)

| Lokasi | Masalah | Tingkat | Tindakan |
|--------|---------|:-------:|----------|
| `src/lib/context/AuthContext.tsx` | `currentUser` di-init dari `DEMO_LOGIN_ACCOUNTS[0]` → UI bisa tampilkan user demo sebelum sesi nyata | **Sedang** | Init `null`; render guarded |
| `src/lib/context/AuthContext.tsx` | `switchRole()` mengganti role via login ulang (demo) | Rendah | Pertahankan sebagai "demo" atau hapus dari kontrak |
| `src/components/navigation/Header.tsx` | Menampilkan `currentUser.name` (dari demo bila belum login) | Sedang | Guard: sembunyikan profil bila belum login |
| `src/app/login/page.tsx` | Quick-login ke akun seed | **OK (disengaja)** | Beri label "Demo" yang jelas (sudah ada) |

`DEMO_LOGIN_ACCOUNTS` **bukan** data bisnis — hanya daftar akun seed untuk quick-login. Sumber kebenaran tetap `users` + `employees`.

---

## 0.3 Verifikasi Integrasi Data (lintas alur)

| Alur | Rantai | Status |
|------|--------|:------:|
| KPI → approval → GPA → VMAI | karyawan input KPI → manager approve → calculate-gpa → analytics VMAI | 🔍 perlu uji e2e |
| Absensi/timesheet → payroll | timesheet → lembur → payroll | 🔍 perlu uji |
| LMS → sertifikat | selesaikan kursus → `course_completions` → `certificates` | 🔍 perlu uji |
| Profil → scope | update profil → `audit_logs` → hanya diri sendiri | ✅ (employeeProfileService) |
| Kandidat → karyawan | (modul baru WS-1..7) | ⏳ WS-1+ |

---

## 0.4 Otorisasi & Scope

- Middleware memverifikasi **JWT nyata** (`verifySession`) — bukan sekadar cek cookie. ✅
- Route API menegakkan `assertCan(session, permission)`. ✅
- Row-level scope via `resolveVisibleEmployeeIds` / `assertEmployeeVisible`. ✅
- Test `tests/api/cross-scope-access.test.ts` & `tests/integration/scope.test.ts` sudah ada. ✅

---

## 0.5 Daftar Gap → Task Perbaikan

| # | Gap | Task |
|---|-----|------|
| G1 | `currentUser` init dari demo | Init `null` + guard render |
| G2 | Header tampil tanpa sesi | Guard profil |
| G3 | Belum ada test e2e alur KPI→GPA→VMAI | Tambah test integrasi |
| G4 | Belum ada test alur absensi→payroll | Tambah test integrasi |
| G5 | Belum ada test LMS→sertifikat | Tambah test integrasi |
| G6 | `switchRole` membingungkan | Dokumentasikan sebagai demo / jadikan eksplisit |

---

## Status
- [x] 0.1 Matriks fitur × role
- [x] 0.2 Inventarisasi residu demo
- [ ] 0.3 Verifikasi integrasi (uji e2e) — perlu task
- [x] 0.4 Otorisasi & scope (sudah kuat)
- [x] 0.5 Gap list

## Progres perbaikan
- [x] **G1** — `currentUser` tidak lagi di-init dari akun demo (init `null`); hanya diisi dari `/auth/me`.
- [x] **G2** — Header menyembunyikan kartu profil bila belum login (`currentUser === null`).
- [x] **G6** — `switchRole` tetap ada sebagai **demo switcher** (berlabel "Demo Switcher" di Header).
- [ ] **G3** — test integrasi KPI→approval→GPA→VMAI (task lanjutan).
- [ ] **G4** — test integrasi absensi/timesheet→payroll (task lanjutan).
- [ ] **G5** — test integrasi LMS→sertifikat (task lanjutan).

**Catatan:** `DEMO_LOGIN_ACCOUNTS` dipertahankan **hanya** untuk quick-login di halaman `/login` (berlabel "Akun Demo") — ini sah untuk presentasi, bukan data bisnis. `AuthContext` tidak lagi memakainya.

