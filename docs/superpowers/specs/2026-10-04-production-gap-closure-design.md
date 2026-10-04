# Spec — Production Gap Closure: 2 Login, Registrasi Mandiri Karyawan, IRT & AI Tech-Test

**Tanggal:** 2026-10-04
**Status:** Menunggu review
**Klasifikasi:** Architectural (subsistem baru: identitas karyawan mandiri + mesin penilaian IRT)
**Terkait:** `docs/superpowers/specs/2026-10-02-rekrutmen-lms-payroll-design.md`,
`docs/superpowers/specs/2026-09-30-eperformiq-demo-to-production-design.md`,
PRD `PRD_Sistem_Penilaian_Karyawan (PT).md` v1.0.0

---

## 0. Latar & Keputusan Owner

Permintaan owner: menjadikan E-PerformIQ **aplikasi production**, dengan alur lengkap
pra-kerja → saat kerja → pasca-kerja. Hasil **audit** menunjukkan **~90% permintaan sudah
dibangun** pada sesi-sesi sebelumnya (portal kandidat, ATS auto-parse, timeline, tes
30/40/30, LMS per-posisi + e-sertifikat, absensi+foto, payroll, pasca-kerja). Karena itu
spec ini **fokus pada gap** (keputusan owner: "audit dulu, spec hanya gap-nya").

**Keputusan owner (hasil brainstorming):**
1. Registrasi karyawan mandiri = **link portal publik TANPA kode undangan**, diamankan
   **verifikasi email (link)** + **approval HR**.
2. Psikometri = **implementasi IRT penuh** (sesuai buku referensi IRT), bobot tetap 30%.
3. Tes teknis (40%) = **soal di-generate AI per jabatan** berdasarkan kualifikasi, lalu
   di-**review/approve HR** sebelum dipakai.
4. Demo = **hapus SEMUA fitur demo** (quick-login, dummy-data, placeholder).
5. Eksekusi: kerjakan semua gap **berurutan** di sesi ini.

---

## 1. Kondisi Saat Ini (baseline terverifikasi)

| # | Kapabilitas | Status |
|---|-------------|--------|
| 1 | Login karyawan (`/login`) & kandidat (`/careers/login`+`register`), sesi terpisah | DONE |
| 2 | Registrasi mandiri **karyawan** | **MISSING** |
| 3 | Portal kandidat (posisi, kualifikasi, kuota, status) | DONE |
| 4 | Form lamaran + upload resume + ATS auto-parse ke DB | DONE |
| 5 | Timeline kandidat + notifikasi | DONE |
| 6 | Tes psikometri/teknis/wawancara bobot 30/40/30 (CTT) | DONE (IRT ditunda) |
| 7 | Jadwal interview + `meeting_url` (HR) | DONE (tampilan ke kandidat perlu dipastikan) |
| 8 | Review HR + rekomendasi AI + keputusan | DONE |
| 9 | LMS per-posisi + e-sertifikat (verifikasi publik) | DONE (route ada; halaman verify publik belum) |
| 10 | Absensi/timesheet + foto | DONE |
| 11 | Payroll (gaji, lembur, THR, BPJS, PPh21, pro-rata) + slip karyawan | DONE |
| 12 | Pasca-kerja (pesangon, handover, exit, LCI) | DONE |
| 13 | Fitur demo (quick-login, dummy-data, placeholder) | **PARTIAL — masih ada** |

**Gap yang akan dikerjakan = WS-1..WS-5 (§2).**

---

## 2. Ruang Lingkup (Workstreams)

### WS-1 — Fondasi Production: hapus demo + 2 login tegas

- Hapus `src/lib/dummy-data/index.ts` dan seluruh impornya.
- Hapus tombol quick-login role di `/login`; `/login` hanya email+password (API `/auth/login`).
- Hapus role-switcher demo di `src/components/navigation/Header.tsx`.
- Hapus inline placeholder demo (mis. `candidates[]` di `ninebox-matrix`, form default di `hr-command`).
- Akun uji dev tetap ada via **seed** (didokumentasikan), bukan tombol demo.

**Acceptance:** tidak ada referensi `dummy-data`/`DEMO_LOGIN_ACCOUNTS`/quick-login di `src/`;
`/login` & `/careers/login` berfungsi dengan kredensial nyata; build & test hijau.

### WS-2 — Registrasi Mandiri Karyawan (email verify + approval HR)

**Alur:**
1. `/employee/register` (publik): Nama, Email, Password, telepon (opsional).
2. Buat `users`(role `EMPLOYEE`) + `employees` status **`PENDING_EMAIL`**; kirim **email link
   verifikasi** (token) via `email_outbox` + `notificationService`.
3. Klik link → `/employee/verify?token=` → status **`PENDING_APPROVAL`**.
4. **HR** di panel utama: lihat pending → **Approve** → **`ACTIVE`** (bisa login, muncul di modul HR) / **Reject**.
5. Anti-abuse: unique email, rate limit, token kadaluarsa (mis. 24 jam), password policy.

**Fallback:** bila provider email mati, HR dapat meng-approve manual (akun aktif walau email
belum terverifikasi — dicatat di audit).

**Database (migrasi `0019_employee_self_registration.sql`):**
- Kolom status tambahan pada `users` (atau tabel `employee_registrations`):
  `status_enum` = `PENDING_EMAIL|PENDING_APPROVAL|ACTIVE|REJECTED`.
- Kolom `verify_token`, `verify_expires_at`, `approved_by`, `approved_at`, `position_hint`.

**API:** `POST /api/v1/employee/register` (publik), `GET /api/v1/employee/verify` (publik),
`GET /api/v1/hr/registrations`, `POST /api/v1/hr/registrations/:id/approve|reject` (HR, audit).

**UI:** `src/app/employee/register/page.tsx`, `src/app/employee/verified/page.tsx`,
`src/components/governance/EmployeeRegistrationPanel.tsx`.

**Acceptance:** pendaftar bisa buat akun → terima email → verifikasi → HR approve → login
dashboard; alur & RBAC teruji; migrasi idempoten.

### WS-3 — Mesin Psikometri IRT (30%)

- Engine baru **`src/lib/engines/irt-engine.ts`**: model **2PL/3PL** (parameter `a`
  diskriminasi, `b` kesulitan, `c` tebak). Estimasi **θ (theta)** via **EAP** (prior N(0,1))
  dengan fallback **MLE**; hitung **fungsi informasi item** `I(θ)=a²·P·(1−P)` dan informasi tes.
- `assessmentService.submitAttempt` untuk PSIKOMETRI memakai IRT: θ → skala 0–100
  (transformasi persentil). Bobot agregat tetap **30% psikometri / 40% teknis / 30% wawancara**.
- Tabel `assessment_questions` sudah punya `irt_a`, `irt_b`; tambah `irt_c` (migrasi `0020`).
- Seed bank IPIP diberi `a`,`b` awal (heuristik); HR dapat override (kelola bank soal).
- Deterministik (tidak crash), driver-agnostic.

**Acceptance:** `tests/integration/irtEngine.test.ts` — θ dari pola jawaban diketahui benar;
monotonisitas P(θ) terhadap θ; informasi tes > 0; skor akhir 0..100.

### WS-4 — Generator Soal Tes Teknis via AI (40%)

- Service **`src/lib/services/technicalTestGenerator.ts`**: masukan `job_postings.required_skills`
  + level → prompt `aiService.generateContent` → JSON MCQ (`prompt, options, correct_key,
  difficulty, skill_tag`) → disimpan sebagai `assessment_questions` type `MCQ` (template
  TECHNICAL posisi), status **DRAFT**.
- **Review HR:** lihat/edit/approve/reject soal AI; hanya soal **APPROVED** yang dipakai kandidat.
- Best-effort: bila AI nonaktif → HR isi manual (jalur lama tetap).
- API: `POST /api/v1/recruitment/assessments/generate-technical` (HR),
  `POST /api/v1/recruitment/assessments/questions/:id/approve` (HR).

**Acceptance:** generate soal dari kualifikasi posisi, tersimpan DRAFT, HR approve → aktif;
test dengan AI mock + manual fallback.

### WS-5 — Hardening & UX kurang

- **Link wawancara ke kandidat:** tampilkan `meeting_url`/jadwal `interview_schedules` di
  halaman status/timeline kandidat (`/careers/status`).
- **Halaman verifikasi sertifikat publik** `/certificates/verify/[code]` (page UI, memakai
  API `/api/v1/certificates/verify/:code`).
- **Dokumentasi sumber OSS** (buku IRT, IPIP) + **ADR** untuk: registrasi mandiri (email+approval),
  keputusan IRT, AI tech-test.
- Update README (akun uji dev, cara jalankan).

---

## 3. Arsitektur & Pola

- **Pola existing diikuti:** route `src/app/api/v1/...`, service `src/lib/services/*`,
  engine murni `src/lib/engines/*`, driver-agnostic via `getDb()`/`createTestDb()`.
- **Identitas ganda:** karyawan (`eperformiq_token`, RBAC 7 role) vs kandidat
  (`eperformiq_candidate_token`, plane terpisah). Registrasi mandiri menghasilkan **akun
  karyawan** (bukan kandidat), status lifecycle `PENDING_*`.
- **AI advisory:** keputusan akhir tetap manusia (HR), sesuai UU PDP/etika.
- **Migrasi idempoten** (`0019`, `0020`), tanpa merusak skema lama.

---

## 4. Keamanan & Kepatuhan

- Verifikasi email + approval HR = gerbang ganda registrasi karyawan; unique email; rate limit;
  token ber-expiry; password hash (bcrypt) seperti existing.
- Kandidat hanya akses datanya; HR kelola rekrutmen; AUDITOR read-only.
- Audit setiap aksi (registrasi, approval, keputusan, generate soal).
- **Catatan:** registrasi terbuka menaikkan permukaan risiko → mitigasi wajib (email verify +
  approval + rate limit). Ini asumsi penting untuk direview.

---

## 5. Definisi Selesai (per workstream)

- Kode + tes (unit/integrasi) hijau; `npm run build` sukses; migrasi idempoten.
- UI berfungsi (cek manual/browser); RBAC & scope teruji.
- README/ADR diperbarui bila ada keputusan arsitektur.

---

## 6. Non-Goals (fase ini)

- Pelatihan/kalibrasi parameter IRT dari data respons nyata (mulai dari parameter heuristik).
- Integrasi HRIS eksternal (SAP/Oracle) — desain seam saja.
- S3/MinIO untuk media (tetap data-URL sesuai keputusan lama).
- Disbursement bank H2H untuk payroll.
