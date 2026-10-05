# ADR 019 — Cosine-Similarity ATS & Konversi Kandidat → Karyawan (HIRED)

**Status:** Diterima
**Tanggal:** 2026-10-05
**Konteks terkait:** WS-6/WS-7 (recruitment pipeline), ADR 008, ADR 016

## Konteks

1. **Analisis seleksi berkas (ATS) tidak akurat.** Pendekatan lama menyusun skor ATS dari kecocokan daftar skill (exact/alias/substring) + komponen administratif. Kandidat dengan CV yang relevan tetap bisa mendapat skor rendah karena satu keyword tidak persis cocok. Pemilik produk meminta mengadopsi pendekatan **cosine similarity** antar teks CV dan job description (repo acuan `kanishksh4rma/Resume-Scanner-for-Job-Description--using-Cosine-Similarity`).
2. **Kandidat & karyawan terpisah total.** Kandidat memakai `candidate_accounts` (cookie & JWT terpisah); karyawan memakai `users` → `employees`. Tidak ada jembatan saat kandidat di-`HIRED`, padahal seluruh fitur kinerja (`/dashboard/employee-portal`) bergantung pada `employee_id`.
3. Permintaan: (a) perbaiki ATS dengan cosine; (b) saat `HIRED`, kandidat "naik kelas" menjadi karyawan dan bisa mengakses employee-portal; (c) employee-portal menampilkan fase **Sebelum/Saat/Setelah Kerja**, dengan fase "Setelah Kerja" read & write (termasuk exit interview).

## Keputusan

### 1. Skor ATS = 50% kecocokan skill + 50% cosine similarity teks
- Modul murni `src/lib/services/cosineSimilarity.ts` (bag-of-words unigram + cosine) mereplikasi `CountVectorizer()` + `cosine_similarity` **tanpa dependency baru**.
- Job description = `posting_title + description + required_skills`.
- Bobot akhir `WEIGHTS = { skills: 0.5, cosine: 0.5 }`. Komponen administratif lama (contact/experience/education/summary) tetap dihitung untuk informasi (`breakdown`) tetapi **tidak** lagi menyusun skor akhir.
- Alasan: lebih tahan terhadap variasi penulisan CV (mis. run DOCX terpecah) dan selaras permintaan; cocok untuk teks panjang.

### 2. Konversi otomatis kandidat → karyawan saat HIRED
- Service `candidateConversionService.convertHiredCandidate()` dipanggil dari `updateApplicationStatus`/`recordDecision` ketika status menjadi `HIRED`.
- Membuat `employees` (status `PROBATION`, `department_id`/`position_id` dari posting) + `users` (role `EMPLOYEE`).
- **Password karyawan = HASH password kandidat** (login dengan sandi sama).
- Akun `candidate_accounts` **dinonaktifkan** (`is_active=false`); login kandidat menolak dengan pesan mengarahkan ke `/login`.
- **Idempoten**: pemanggilan ulang memakai record yang sudah ada (cek `users` by email).
- **Best-effort**: kegagalan konversi tidak memblokir perubahan status (di-log).

### 3. Fase employee-portal + offboarding self-service
- Employee-portal tetap di `/dashboard/employee-portal`. Ditambah 3 tab fase (visual): **Sebelum / Saat / Setelah Kerja**.
- Fase "Setelah Kerja" = fitur offboarding self **read & write**: baca status + checklist serah terima + ringkasan pesangon; ajukan resign; tandai item serah terima; kirim exit interview.
- Semua aksi **dibatasi ke karyawan pemilik sesi** (`employee_id` dari sesi; `employee_id` di body diabaikan — anti-spoof). Verifikasi resmi handover tetap hak HR.

### 4. Perubahan skema (aditif, idempoten)
- Migrasi `0022_offboarding_self_and_exit_interview.sql`:
  - `ALTER TABLE knowledge_handovers ADD COLUMN IF NOT EXISTS notes TEXT;`
  - `CREATE TABLE IF NOT EXISTS exit_interviews (...)` (employee_id, offboarding_request_id, feedback, overall_rating, would_recommend, UNIQUE(employee_id, offboarding_request_id)).
- RBAC: tambah `offboarding:read` (termasuk EMPLOYEE/HR/BOD/…) & `offboarding:write` (EMPLOYEE/HR/PEOPLE_MANAGER/SUPER_ADMIN).

## Konsekuensi

- Skor ATS kandidat **berubah** dibanding sebelumnya (kini menekankan relevansi teks). Ambang seleksi HR perlu ditinjau ulang bila berbasis skor.
- Karyawan baru hasil konversi berstatus `PROBATION` dengan `base_salary=0` sampai HR melengkapi data kepegawaian/payroll.
- Kandidat yang dikonversi **tidak bisa lagi** login ke portal kandidat (by design).
- Tidak ada tabel besar baru selain `exit_interviews`; jejak konversi cukup via `users`/`employees` + `candidate_accounts.is_active=false`.

## Alternatif yang ditolak

- Menulis ulang layanan kinerja agar berbasis `candidate_id` (terlalu besar & menduplikasi).
- Menghapus employee-portal lama / memindahkannya ke `/careers` (permintaan pemilik produk: tetap di tempat lama).
- Menyimpan exit interview tanpa tabel (ditunda) — pemilik produk memilih termasuk sekarang.
