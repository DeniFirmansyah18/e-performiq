# Spec — Cosine-Similarity ATS & Konversi Kandidat → Karyawan (HIRED)

**Status:** Menunggu persetujuan (belum ada kode).
**Tanggal:** 2026-10-05
**Klasifikasi:** Arkitektural (brainstorming → spec → plan → approval → implementasi)

---

## 1. Latar belakang & masalah

Dua keluhan/permintaan dari pemilik produk:

1. **Analisis seleksi berkas (ATS) masih tidak sesuai.** Kualifikasi yang jelas tertulis di CV (mis. "TypeScript, Next.js, PostgreSQL") masih bisa dilaporkan "tidak sesuai". Perbaikan ekstraksi DOCX sebelumnya belum menyelesaikan keluhan; pemilik produk meminta mengadopsi pendekatan repo `kanishksh4rma/Resume-Scanner-for-Job-Description--using-Cosine-Similarity` (cosine similarity antar teks CV dan job description).
2. **Alur kandidat → karyawan.** Setelah lamaran kandidat berstatus **HIRED**, kandidat harus "naik kelas" menjadi karyawan dan bisa mengakses fitur yang kini ada di `/dashboard/employee-portal` untuk mengubah profil dan menginput kinerja **sebelum–saat–setelah** bekerja.

## 2. Keputusan yang sudah disetujui

- **A. Cosine ATS.** Ganti/augment skor ATS dengan cosine similarity (bag-of-words unigram) — meniru `CountVectorizer()` + `cosine_similarity` dari repo acuan, diimplementasikan di TypeScript tanpa dependency baru. "Job description" = gabungan `posting_title + description + required_skills`.
- **B. Provision otomatis saat HIRED.** Saat status lamaran → `HIRED`, sistem membuat/menautkan record `employees` + `users` (role `EMPLOYEE`), memetakan `department_id`/`position_id` dari posting. Password karyawan baru = **copy hash password kandidat**. Akun `candidate_accounts` **dinonaktifkan**; kandidat diarahkan ke `/login` (portal karyawan). Idempoten.
- **C. employee-portal tetap di `/dashboard/employee-portal`** — TIDAK dipindah ke `/careers`.
- **D. Fase eksplisit (Pilihan B ringan).** Tambah 3 tab/pembatas fase di employee-portal yang mengelompokkan kartu fitur yang SUDAH ADA — tanpa mengubah logika fitur.
- **E. Pendekatan isi fase: realistis.** Kelompokkan yang ada; fase "Setelah Kerja" menampilkan **status offboarding** — **DIREVISI: read & write** (karyawan dapat melakukan aksi offboarding, bukan sekadar membaca).

## 3. Non-goals (di luar cakupan)

- Menulis ulang service kinerja untuk nentang `candidate_id` (kita memakai `employee_id`).
- Memindahkan fitur ke `/careers` atau menghapus `/dashboard/employee-portal`.
- Fitur baru "kontrak/dokumen/IT provisioning" (pra) — di luar cakupan.
- Rewrite modul offboarding HR; fitur karyawan memakai tabel yang ada (`offboarding_requests`, `knowledge_handovers`, `severance_calculations`). Hanya **menambah** endpoint/aksi sisi karyawan bila belum ada.
- Integrasi Python/sklearn sebagai runtime (algoritma direplikasi di TS).

---

## 4. Desain — Bagian 1: Cosine-Similarity ATS

### 4.1 Modul baru `src/lib/services/cosineSimilarity.ts`
Fungsi murni, deterministik, tanpa dependency:

```
tokenize(text: string): string[]        // lowercase, ambil [a-z0-9+#.]+ , buang stopword umum
buildVocabulary(docs: string[]): Map<string, number>
termCounts(tokens, vocab): number[]
cosineSimilarity(a: number[], b: number[]): number   // 0..1
matchPercentage(resumeText: string, jobText: string): number   // 0..100, dibulatkan 2 desimal
```

Meniru `CountVectorizer(cv.fit_transform([resume, job]))` + `cosine_similarity(...)[0][1]`:
- Vokabulari = unigram dari **kedua** dokumen (union).
- Vektor = frekuensi mentah (count) tiap token.
- Cosine = dot / (‖a‖·‖b‖); 0 bila salah satu vektor nol.

### 4.2 Integrasi di `atsService`
- `runAts` menghitung `jobText` (dari `job_postings`), lalu `cosine = matchPercentage(resumeText, jobText)`.
- Skor akhir ATS: **kecocokan skill (existing)** dikombinasikan dengan **cosine**, dengan formula eksplisit:
  - `skillsScore` = `skillResult.matchRatio * 100` (existing).
  - `textScore` = `cosine` (0..100).
  - `score = round(0.5 * skillsScore + 0.5 * textScore)` — bobot 50/50 (dapat disetel; dikonfigurasi konstanta).
- `AtsResult` diperluas: `{ cosine: number; breakdown: {..., cosine: number} }` (aditif; pemanggil lama tetap jalan).
- `matched`/`missing` skill tetap dihitung & dikembalikan untuk tampilan, tetapi **skor utama tidak lagi 100% bergantung pada matched/missing** → mengatasi keluhan "seharusnya sesuai tapi dibilang tidak sesuai".
- Simpan `cosine` ke `resume_parses.parsed_json` (tanpa perubahan skema).

### 4.3 Dampak ke tampilan
- `/careers` (setelah submit) & panel HR menampilkan skor ATS + persen cosine. Label "Kualifikasi yang belum terlihat" tetap ada sebagai info, tetapi skor tidak lagi jatuh hanya karena satu keyword tidak persis cocok.

### 4.4 Verifikasi (bagian 1)
- Unit test `cosineSimilarity`: identik → 1.0; tanpa irisan → 0; nol-vektor → 0; deterministik.
- Integrasi: CV yang memuat skill posting (dengan run terpecah DOCX) → cosine tinggi, skor ATS tinggi.
- Regression: kasus "TypeScript, Next.js, PostgreSQL" tetap lolos.

---

## 5. Desain — Bagian 2: Konversi Kandidat → Karyawan saat HIRED

### 5.1 Service baru `src/lib/services/candidateConversionService.ts`
```
convertHiredCandidate(db, { applicationId, actorUserId }): Promise<{
  employeeId: string; userId: string; created: boolean;
}>
```
Alur (semua idempoten, dibungkus transaksi/best-effort konsisten dengan pola repo):
1. Ambil lamaran + kandidat + posting: `job_applications → candidates → job_postings` (dapat `email`, `full_name`, `phone`, `department_id`, `position_id`, `posting_title`).
2. Cek apakah sudah ada `users`/`employees` untuk email kandidat:
   - Bila sudah ada → pakai ulang (idempoten), kembalikan `created:false`.
3. Buat `employees` (bila belum ada):
   `employee_code = randomCode('EMP')`, `status='PROBATION'`, `base_salary=0`, `join_date=CURRENT_DATE`, `department_id`/`position_id` dari posting.
4. Buat `users` (bila belum ada): `email` kandidat, `password_hash` = **hash kandidat** (dibaca dari `candidate_accounts.password_hash`), `role='EMPLOYEE'`, `is_active=TRUE`, `employee_id` = employee baru.
5. Nonaktifkan akun kandidat: `UPDATE candidate_accounts SET is_active=FALSE` (simpan `converted_user_id`/`converted_employee_id` — **lihat 5.3** untuk penyimpanan).
6. Kembalikan `{ employeeId, userId, created }`.

### 5.2 Trigger
Di `updateApplicationStatus` (dan/atau `recordDecision`) di `candidateService.ts`/`candidateReviewService.ts`: setelah status menjadi `HIRED`, panggil `convertHiredCandidate` (best-effort, tidak memblokir; log bila gagal). Dipanggil juga dari alur keputusan `recordDecision` yang memetakan `HIRED`.

### 5.3 Jejak konversi (tanpa skema baru bila mungkin)
- Simpan penanda di tabel yang ada lebih dulu: bila `candidates` sudah punya kolom relasi, gunakan; jika tidak, simpan pada `candidate_accounts` **hanya bila sudah ada kolom yang cocok**. Jika benar-benar butuh kolom baru → **migrasi aditif** kecil + ADR (mis. `candidate_accounts.converted_employee_id UUID`). Keputusan: **kumpulkan dulu**; default = **tanpa kolom baru** (cukup nonaktifkan akun + jejak pada `users`/`employees`).

### 5.4 Pesan & UX kandidat setelah HIRED
- Endpoint `GET /api/v1/careers/auth/me` tetap; namun `POST /api/v1/careers/auth/login` menolak akun `is_active=false` dengan pesan: *"Anda telah menjadi karyawan. Silakan login di portal karyawan (/login)."*
- Halaman `/careers`/portal kandidat: setelah submit, bila lamaran `HIRED`, tampilkan banner + tombol menuju `/login`.

### 5.5 Verifikasi (bagian 2)
- Integration test: set `HIRED` → `employees` + `users` dibuat; login kandidat lama → ditolak dengan pesan; login karyawan baru (sandi kandidat) → sukses & `session.employeeId` valid.
- Idempotensi: panggil dua kali → tidak ada duplikat.

---

## 6. Desain — Bagian 3: Fase Eksplisit di employee-portal (ringan)

### 6.1 UI
Di `src/app/dashboard/employee-portal/page.tsx`, tambah 3 **tab fase** (state `activePhase: 'PRE' | 'DURING' | 'POST'`) di atas daftar kartu, dengan judul: **"Sebelum Kerja" / "Saat Kerja" / "Setelah Kerja"**. Kartu fitur yang ada dikelompokkan ke fase; **tidak ada perubahan logika fitur**.

Pemetaan (realistis):
- **PRE:** Onboarding LMS (`OnboardingPanel`).
- **DURING:** Scorecard GPA, Sasaran Kerja & OKR, Pengembangan & Pembelajaran; Aksi Cepat (Timesheet, Slip Gaji, Career Path, Reimbursement, Helpdesk, KPI Evidence, Job Board, Profil).
- **POST:** panel **"Offboarding & Serah Terima" (read & write)** yang memungkinkan karyawan: melihat status offboarding-nya, melihat checklist serah terima (handover), **menginisiasi pengajuan resign** miliknya sendiri, menandai item serah terima miliknya, dan melihat ringkasan pesangon (read).

### 6.2 Fitur fase "Setelah Kerja" — read & write (BARU)

Dibangun di atas tabel yang sudah ada (`offboarding_requests`, `knowledge_handovers`, `severance_calculations`) + repository `offboardingRepository`. Semua aksi **dibatasi ke karyawan yang bersangkutan** (selaras `session.employeeId`).

**REVIEW:** komponen `src/components/employee/OffboardingSelfPanel.tsx` + service/endpoint pendukung.

Read:
- `GET /api/v1/offboarding/me` — ringkasan offboarding karyawan sendiri: request terbaru, status (`INITIATED`/…), tanggal, daftar `knowledge_handovers` + progress verifikasi, ringkasan `severance_calculations` (bila ada). Bila tak ada request → `{ request: null }`.

Write (perlu izin baru / reuse `offboarding:write`):
- `POST /api/v1/offboarding/me` — karyawan **menginisiasi** pengajuan resign sendiri (`reason_for_leaving`, `resignation_notice_date`, `last_working_day`). `employee_id` **dipaksa** = `session.employeeId` (tidak boleh di-spoof dari body).
- `PATCH /api/v1/offboarding/me/handover/[id]` — karyawan menandai item serah terima **miliknya** (mis. menandai "siap"/menambah catatan). Verifikasi resmi tetap HR (`/handover/[id]/verify`), sehingga: setidaknya `UPDATE knowledge_handovers SET ... WHERE id=$1 AND offboarding_request_id IN (SELECT id FROM offboarding_requests WHERE employee_id=$2)`. **Keputusan: minimal menandai item sebagai "disiapkan karyawan" via kolom `notes`/`is_verified` tidak diubah** — verifikasi tetap hak HR. Bila perlu kolom baru → migrasi aditif + ADR 019.
- (Opsional) `POST /api/v1/offboarding/me/exit-interview` body `{ feedback }` — disimpan ke tabel baru `exit_interviews` (lihat 6.4). **Keputusan: TERMASUK SEKARANG.**

RBAC: tambah `offboarding:read`/`offboarding:write` bila belum ada (`src/lib/auth/rbac.ts`), sertakan `EMPLOYEE`.

### 6.4 Exit interview (BARU, termasuk sekarang)
- Tabel baru `exit_interviews`:
  ```
  id UUID PK, employee_id UUID → employees(id) ON DELETE CASCADE,
  offboarding_request_id UUID → offboarding_requests(id) ON DELETE SET NULL,
  feedback TEXT NOT NULL, overall_rating INT (1..5), would_recommend BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, UNIQUE (employee_id, offboarding_request_id)
  ```
- Migrasi aditif `00XX_exit_interviews.sql`.
- Endpoint: `POST /api/v1/offboarding/me/exit-interview` (upsert), `GET /api/v1/offboarding/me` menyertakan `exitInterview`.
- UI `OffboardingSelfPanel`: form exit interview (rating + rekomendasi + feedback) — read & write.

### 6.3 Verifikasi (bagian 3)
- Unit: pemetaan `phaseOf('offboarding')==='POST'`.
- Route: `GET /offboarding/me` mengembalikan request milik karyawan; `POST /offboarding/me` membuat request dengan `employee_id` = karyawan sesi (uji tidak bisa spoof); `PATCH .../handover/[id]` menolak handover milik karyawan lain.
- Manual/browser: tab fase & aksi read/write berfungsi; tak ada regresi fitur.

---

## 7. Risiko & mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Skor ATS berubah tiba-tiba (semua kandidat) | Bobot 50/50, konstanta mudah disetel; tampilkan kedua komponen; uji dengan data seed |
| Duplikasi karyawan saat HIRED berulang | Idempoten via cek email `users`/`employees` |
| Kandidat terkunci tak sengaja | Nonaktifkan hanya saat sukses provisioning; sediakan pesan jelas + jalur `/login` |
| Perlu kolom baru | Hindari; bila terpaksa → migrasi aditif + ADR |
| Regresi employee-portal | Perubahan hanya pengelompokan visual (state tab), logika tak disentuh |

## 8. Kriteria sukses

1. CosA: CV yang memuat kriteria posting → skor ATS tinggi & konsisten; "seharusnya sesuai" tidak lagi dilaporkan "tidak sesuai".
2. `HIRED` → `employees` + `users` dibuat (idempoten) dengan dept/posisi dari posting; akun kandidat nonaktif; kandidat diarahkan ke `/login`.
3. Karyawan baru bisa login (sandi kandidat) dan mengakses `/dashboard/employee-portal`.
4. Employee-portal menampilkan 3 tab fase tanpa regresi fitur.
5. Full suite hijau + build sukses; tanpa push hingga review.

---

## 9. Pertanyaan terbuka (non-blocking)

- Bobot akhir ATS: 50/50 (skill/cosine) — dapat disetel.
- Perlu kolom jejak konversi? Default: tidak (tanpa migrasi) kecuali implementasi menuntut.
- Fase "Setelah Kerja": **read-only** (dikonfirmasi).
