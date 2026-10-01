# Spec: Materi Pembelajaran, Portal Karier Publik, Sertifikasi, & Self-Service Profil

**Tanggal:** 2026-10-01
**Status:** Menunggu review
**Terkait:** PRD `PRD_Sistem_Penilaian_Karyawan (PT).md` §3.1/§5.1/§5.4, ADR 008/009
**Melanjutkan:** integrasi model Moodle (`docs/superpowers/specs/2026-09-30-moodle-lms-integration-design.md`)

---

## 1. Tujuan & Kriteria Sukses

Melengkapi aplikasi agar:
1. **Materi pembelajaran benar-benar bisa dipelajari** mandiri oleh karyawan (bukan hanya daftar kursus): kursus memiliki **modul/lesson** (teks/video/PDF/kuis) dengan pelacakan penyelesaian.
2. **Calon karyawan (eksternal)** dapat mengajukan **CV + data diri** melalui **portal karier publik** (tanpa login) dan memantau status lamaran.
3. **Pelatihan wajib karyawan baru** terintegrasi: setelah pelatihan selesai (100%), **sertifikat terbit otomatis** (nomor unik + verifikasi publik).
4. Karyawan dapat **mengubah data diri kepegawaian** (field terbatas) sendiri, dengan jejak audit.

**Kriteria sukses:**
1. `npm run test` hijau (unit + integrasi baru); `npm run build` sukses; `npm run db:reset` sukses.
2. Karyawan dapat memilih kursus, membuka lesson, menandai selesai, dan (untuk kursus wajib) menerima sertifikat — semua terverifikasi live.
3. Portal karier publik dapat diakses tanpa sesi, menerima lamaran, dan menampilkan status via nomor lamaran.
4. Menu profil dapat menyimpan field terbatas dan menulis satu baris `audit_logs` per perubahan.

---

## 2. Latar & Temuan

- Integrasi model Moodle (ADR 008) sudah menyediakan katalog kursus, enrollment, competency evidence, badge, learning plan. Namun `moodle_courses` **belum punya materi** — karyawan hanya bisa mendaftar, belum memiliki isi untuk dipelajari.
- Rekrutmen saat ini hanya **internal** (`internal_applications.applicant_employee_id` wajib) + `recruitment_assessments` (diinput HR). **Belum ada** jalur kandidat eksternal dengan data diri + CV.
- Sertifikasi: `badge_awards` ada, tetapi belum ada **sertifikat** formal bernomor/terverifikasi untuk pelatihan.
- Data diri: `employees` hanya dapat diubah oleh HR; belum ada self-service.

---

## 3. Ruang Lingkup

### WS-1 — Skema (migrasi `0010_recruitment_learning_profile.sql`)
Tabel baru (idempoten):
- `course_modules (id, course_id→moodle_courses, title, order_index, content_type
  ENUM('TEXT','VIDEO','PDF','QUIZ'), content_url, content_body, quiz_key JSONB)`
- `course_completions (id, employee_id→employees, course_id→moodle_courses, module_id→course_modules,
  completed_at, UNIQUE(employee_id, module_id))`
- `certificates (id, certificate_no UNIQUE, verification_code UNIQUE, employee_id→employees,
  course_id→moodle_courses, issued_at)`
- `candidates (id, full_name, email, phone, address, birth_date, education, resume_url, created_at)`
- `job_applications (id, application_no UNIQUE, candidate_id→candidates, job_posting_id→job_postings,
  cover_letter, status ENUM('SUBMITTED','SCREENING','INTERVIEW','OFFERED','HIRED','REJECTED'), applied_at)`

Perluasan tabel lama (`ADD COLUMN IF NOT EXISTS`):
- `job_postings += is_public BOOLEAN DEFAULT FALSE`
- `employees += date_of_birth DATE, address TEXT, emergency_contact_name VARCHAR(150),
  emergency_contact_phone VARCHAR(30), photo_url TEXT, bio TEXT`

Enum baru: `content_type_enum`, `application_status_enum` (idempoten via `DO $$`).
`schema.test` diperbarui: 48 → 53 tabel (5 tabel baru), 16 → 18 enum.

### WS-2 — Engine & Service
Engine murni:
- `quiz-engine.ts`: `gradeQuiz(answers: number[], key: {q:number,a:number}[]): { correct:number; total:number; score:number; passed:boolean }` (lulus bila skor ≥ 70).
- `certificate-engine.ts`: `buildCertificateNo(employeeCode, courseCode, date): string`
  (mis. `CERT-EMP20240042-CLOUDARCH-20261001`), `buildVerificationCode(seed): string`.

Service:
- `courseContentService.ts`: `listModules(courseId, employeeId?)` (sertakan completion per modul),
  `getLesson(moduleId)`, `submitQuiz(employeeId, moduleId, answers)`, `completeModule(employeeId, moduleId)`
  → insert `course_completions` (idempoten) → recompute progress via `completion-engine` →
  bila progress 100%: panggil `lmsObserver.onCourseCompleted` (evidence+badge) lalu
  `certificateService.issueCertificate` bila kursus wajib onboarding.
- `certificateService.ts`: `issueCertificate(employeeId, courseId)` (idempoten; generate
  `certificate_no` + `verification_code`), `getCertificatesForEmployee`, `verifyCertificate(code)`.
- `candidateService.ts`: `listPublicPostings()`, `submitApplication(payload)` (buat candidate +
  application + `application_no` unik), `getApplicationStatus(applicationNo)`,
  `listCandidates()` (HR), `updateApplicationStatus(id, status)` (HR).
- `employeeProfileService.ts`: `getMyProfile(employeeId)`,
  `updateMyProfile(employeeId, allowedFields, actorUserId)` — hanya field
  `phone_number, address, date_of_birth, emergency_contact_name, emergency_contact_phone, photo_url, bio`;
  menulis `audit_logs` (action UPDATE, entity employees, old/new JSONB) via `auditService`.

Integrasi: memakai `completion-engine` + `lmsObserver` yang sudah ada; **tidak** mengubah `gpa-engine`,
`severance-engine`, atau `vmai-engine`.

### WS-3 — API
Publik (tanpa sesi, validasi zod + honeypot field `website` harus kosong):
- `GET /api/v1/careers/postings` — lowongan publik (is_public & OPEN)
- `POST /api/v1/careers/apply` — kirim lamaran (data diri + resume_url) → kandidat + `application_no`
- `GET /api/v1/careers/status/:applicationNo` — status lamaran
- `GET /api/v1/certificates/verify/:code` — verifikasi sertifikat

Terautentikasi:
- `GET /api/v1/learning/courses/:id/modules` · `GET /api/v1/learning/modules/:id`
- `POST /api/v1/learning/modules/:id/complete` · `POST /api/v1/learning/modules/:id/quiz`
- `GET /api/v1/learning/certificates`
- `GET /api/v1/profile/me` · `PATCH /api/v1/profile/me`

HR (`learning:manage` / `recruitment:manage`):
- `GET /api/v1/recruitment/candidates` · `PATCH /api/v1/recruitment/candidates/:id/status`

RBAC baru: `recruitment:read`/`recruitment:manage` (HR_MANAGER, SUPER_ADMIN); `profile:read`/`profile:write`
(semua role untuk dirinya). Mengikuti pola `getAuthSession` → `assertCan` → scope → `ok()`/`problem()`.

### WS-4 — UI
- **Lesson viewer + Sertifikat** di modul Learning (portal karyawan): daftar modul per kursus,
  isi lesson (TEXT/VIDEO/PDF/QUIZ), tombol "Tandai selesai", kuis, dan tab "Sertifikat Saya".
- **Portal Karier publik** `/careers` (tanpa login): daftar lowongan + form lamaran + halaman
  sukses dengan nomor lamaran + cek status.
- **Menu "Profil Saya"** di portal karyawan: form field terbatas; field sensitif read-only.
- **HR Command Center:** panel "Rekrutmen Kandidat" (daftar pelamar + ubah status) dan panel
  "Onboarding Training" (checklist pelatihan wajib + status sertifikasi).

UI memakai **frontend-design** setelah spec+plan.

### WS-5 — Seed, Verifikasi, ADR
- Seed: modul/lesson untuk 2–3 kursus (termasuk kursus wajib onboarding dengan QUIZ), 1 lowongan
  publik, 1 sertifikat contoh, kandidat + lamaran contoh (idempoten).
- Verifikasi: test hijau + build + `db:reset` + smoke browser (portal karier publik, lesson viewer,
  menu profil).
- ADR: `010-public-careers-and-candidate-intake.md`, `011-course-materials-and-certification.md`.

---

## 4. Non-Goals
- ATS penuh (multi-tahap, scorecard, penjadwalan wawancara otomatis dari lamaran publik).
- Penyimpanan berkas biner (unggahan CV) — memakai link/URL CV; unggahan objek (MinIO/S3) di luar
  lingkup (sesuai ADR 007 non-goals).
- Approval berjenjang untuk perubahan profil (dipilih: update langsung + audit).
- Perubahan formula GPA.

---

## 5. Risiko & Mitigasi
| Risiko | Mitigasi |
|---|---|
| Jalur publik disalahgunakan (spam lamaran) | Validasi zod ketat + honeypot + batas panjang field; rate-limit ringan berbasis in-memory |
| Perubahan profil menyentuh field sensitif | Allowlist field; field sensitif read-only di UI & ditolak di API |
| Duplikasi sertifikat saat menyelesaikan ulang | `UNIQUE(employee_id, course_id)` + ON CONFLICT DO NOTHING |
| `schema.test` gagal karena tabel baru | Update ekspektasi (55 tabel / 18 enum) + jalankan suite |
| Nomor lamaran/sertifikat tidak unik | Generator deterministik + kolom UNIQUE |

---

## 6. Keputusan Owner (brainstorm)
1. Materi: **modul + lesson/kuis ringan**. 2. Rekrutmen: **portal karier publik + form lamaran**.
3. Sertifikasi: **otomatis saat pelatihan wajib selesai**. 4. Data diri: **self-service field terbatas + audit**.
5. Profil: **update langsung + `audit_logs`** (tanpa tabel request berjenjang).
6. Cakupan: **menyeluruh (DB → API → UI)**.
