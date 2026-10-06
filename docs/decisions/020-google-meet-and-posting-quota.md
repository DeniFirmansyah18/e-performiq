# ADR 020 — Integrasi Google Meet REST API & Kuota Lowongan Override

**Status:** Diterima
**Tanggal:** 2026-10-06
**Konteks terkait:** WS-12 (kelola lowongan), WS-13 (penjadwalan wawancara), ADR 010

## Konteks

1. Bug penjadwalan wawancara: daftar jadwal HR selalu tampil "Belum ada jadwal." meski penjadwalan sukses. Akar masalah: `GET /api/v1/recruitment/interviews` melakukan `LEFT JOIN users u ... SELECT u.full_name`, padahal tabel `users` **tidak** memiliki kolom `full_name` (nama karyawan ada di `employees.full_name`, dihubungkan via `users.employee_id`). Query gagal (500), dan panel menelan error secara diam-diam.
2. Tombol "Buat Ruang" hanya menampilkan instruksi manual. Pemilik produk meminta pembuatan tautan ruang otomatis memakai **Google Meet REST API** bila kredensial tersedia, dengan fallback ke generator tautan bila belum.
3. Kuota lowongan selalu diambil dari `manpower_plans.approved_quota`. HR membutuhkan kuota spesifik per lowongan (mis. merekrut lebih sedikit dari kuota MPP), tanpa mengubah MPP.
4. Navbar portal kandidat tidak konsisten antar halaman (lamaran, status, portal). Perlu navbar seragam + tombol kembali, **hanya** untuk kandidat yang login.

## Keputusan

### 1. Perbaikan join jadwal wawancara
- `GET /api/v1/recruitment/interviews` kini: `LEFT JOIN users u ON u.id = i.interviewer_user_id LEFT JOIN employees e ON e.id = u.employee_id`, memilih `COALESCE(e.full_name, u.email) AS "interviewerName"`.
- Panel `InterviewSchedulerPanel.loadInterviews` **menampilkan pesan error** (bukan menelan) saat respons gagal.

### 2. Google Meet REST API + fallback
- `POST /api/v1/recruitment/interviews/generate-room` (HR, `recruitment:manage`). Memakai `googleMeetService.generateInterviewRoom()`:
  - Bila `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` + `GOOGLE_REFRESH_TOKEN` di-set (dan `GOOGLE_MEET_ENABLED !== 'false'`): tukar refresh token → access token → `POST https://meet.googleapis.com/v2/spaces`.
  - Bila tidak / gagal: fallback generator tautan `https://meet.google.com/xxx-xxxx-xxx` (huruf non-ambigu).
- `GET .../generate-room/config` mengembalikan `{ googleMeetConfigured }` untuk UI.
- **Best-effort**: kegagalan API tidak pernah menggagalkan penjadwalan; tautan fallback selalu dikembalikan.

### 3. Kuota override per lowongan
- Migrasi `0023_job_posting_quota.sql`: `ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS quota INTEGER;` (NULL = fallback).
- `listHrPostings` memakai `COALESCE(jp.quota, mp.approved_quota, 0)`.
- `PostingSchema`/`UpdateSchema` menerima `quota` (int ≥ 0 ≤ 10000, nullable). Form "Kelola Lowongan" menambah input Kuota opsional.

### 4. Navbar kandidat terpadu
- Komponen `CandidateTopBar` (client): cek `/api/v1/careers/auth/me`; **tidak dirender** untuk pengunjung anonim (mis. beranda `/careers` publik), tampil penuh (back button + notifikasi + logout) saat sesi kandidat aktif.
- Dipasang di `/careers`, `/careers/status`, `/careers/portal`, dan `/careers/portal/assessments` (menggantikan header inline).

### 5. Notifikasi sukses HR + auto-refresh
- `RecruitmentPanel` menampilkan **modal sukses** setelah ubah status / simpan keputusan, dan memanggil `load()` otomatis (tanpa muat ulang peramban).

## Konsekuensi

- Menambah kolom `job_postings.quota` (aditif, idempoten) — jumlah tabel tidak berubah.
- Integrasi Google Meet bersifat opsional; tanpa env, fitur tetap berjalan dengan tautan fallback (bukan ruang Meet nyata).
- Perubahan hanya di sisi tampilan/servis rekrutmen; tidak mengubah skema inti lain.

## Alternatif yang ditolak

- **Zoom API** — kredensial & verifikasi app lebih berat; pemilik produk memilih Google Meet.
- **Paksa konfigurasi Meet** (tanpa fallback) — akan memblokir penjadwalan pada lingkungan tanpa kredensial.
- **Navbar tampil untuk semua pengunjung `/careers`** — diminta tidak tampil bagi pengunjung yang belum login.
