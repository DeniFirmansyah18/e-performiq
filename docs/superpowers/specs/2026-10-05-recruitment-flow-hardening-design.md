# Recruitment Flow Hardening & UX Parity — Design Spec

Tanggal: 2026-10-05
Status: Menunggu review
Terkait: WS-4 (AI technical test), WS-5 (hardening), ADR 010/011/016/018

## 1. Tujuan

Menutup celah alur rekrutmen kandidat publik (`/careers`) agar utuh dari
lamaran → tes → interview (link meeting) → keputusan, memperbaiki notifikasi
email/WA yang tidak berjalan, dan menyelaraskan UX login/registrasi serta menu
karyawan dengan menu utama.

## 2. Lingkup (in-scope)

Enam pekerjaan, semuanya pada **pipeline kandidat publik** (`job_applications`):

| # | Item | Kategori |
|---|------|----------|
| F1 | Teks input terlihat (hijau/hitam) di login & register | Bug UI |
| F2 | Menu karyawan selaras dengan menu utama | UI parity |
| F3 | Notifikasi email + WhatsApp saat lamaran dikirim (perbaiki) | Bug |
| F4 | Ganting tes: kandidat hanya bisa tes setelah status `SCREENING` | Rule baru |
| F5 | HR: panel buat **link meeting** + tandai interview **selesai**; kandidat melihat link | Fitur baru |
| F6 | Perluasan kendali status HR: `OFFERED`, `HIRED`, `REJECTED` | Perluasan |

**Out-of-scope:** pipeline internal (`internal_applications`, `interview_slots`),
integrasi Zoom/Google Calendar otomatis (hanya *opsional* "generate ruang" bila
provider dikonfigurasi), perubahan skema DB (kecuali aditif bila benar-benar
diperlukan — lihat §5).

## 3. Temuan Kode (dasar keputusan)

- **Root cause teks input tak terlihat:** `src/app/layout.tsx:15` memaksa
  `<html class="dark">` + `<body class="... text-slate-100">`. Input yang tidak
  punya kelas `text-*` mewarisi **teks nyaris putih** di atas kartu putih →
  tak terlihat. Terjadi di `careers/login`, `careers/register`,
  `employee/register`. `login/page.tsx` (karyawan) sudah benar.
- **Notifikasi "tidak berjalan":**
  - `notifyApplicationSubmitted` dipanggil di `apply/route.ts` dalam
    `try/catch` yang menelan error → respons selalu sukses.
  - `EMAIL_FROM=onboarding@resend.dev` → Resend **hanya** boleh kirim ke email
    pemilik akun. Penerima lain → `FAILED` (tercatat di `email_outbox`).
  - WhatsApp hanya dikirim bila `phone` ada & `normalizePhone` lolos
    (`/^62\d{8,13}$/`). Fonnte butuh device/token aktif.
  - Provider `'none'` (env tak terbaca) → semua tetap `QUEUED`.
- **Tidak ada gating tes:** `startAttempt()` tidak memeriksa
  `job_applications.status` sama sekali.
- **API interview tanpa UI:** `POST /api/v1/recruitment/interviews` menerima
  `meetingUrl` tetapi tidak ada komponen yang memanggilnya; tidak ada UI buat
  link, tidak ada UI tandai interview DONE.
- **`recruitment:manage`** = SUPER_ADMIN, HR_MANAGER; `recruitment:read` +=
  BOD, AUDITOR.

## 4. Desain per-item

### F1 — Teks input terlihat

Tambah kelas eksplisit ke **semua** input auth: `text-[#0f172a]`
`placeholder-[#94a3b8]` (opsional: `bg-white`). File:
- `src/app/login/page.tsx` (benar; tambahkan `placeholder-*` bila belum)
- `src/app/careers/login/page.tsx` (email+password)
- `src/app/careers/register/page.tsx` (4 input)
- `src/app/employee/register/page.tsx` (5 input)

Pendekatan tahan lama (opsional, direkomendasikan): tambah aturan basis di
`globals.css`:
```css
input, textarea, select { color: #0f172a; }
```
dan komponen `Input` bersama. Untuk saat ini cukup per-input agar perubahan minim.

**Uji:** render halaman, ketik teks, pastikan warna `#0f172a`. (Manual/browser.)

### F2 — Paritas menu karyawan

`src/app/dashboard/employee-portal/page.tsx` sudah memakai komponen yang sama
(`FeatureGrid/FeatureCard/ActionCard/ExpandablePanel`). Selaraskan:
- Kolom grid `ActionCard`: `lg:grid-cols-5` → `lg:grid-cols-4` (sama seperti HR).
- Header hero & judul seksi mengikuti pola HR (`text-2xl font-extrabold
  text-[#0f172a] tracking-tight`, subjudul `text-[11px] text-[#64748b]`).
- Pastikan jarak (`space-y-6 max-w-[1400px] mx-auto pb-12`) identik.

**Uji:** bandingkan visual kedua halaman (browser).

### F3 — Perbaiki notifikasi email + WhatsApp

**Masalah inti & perbaikan:**
1. **Observability:** jangan telan error diam-diam. `apply/route.ts` mengembalikan
   status notifikasi ringkas (`{ email: 'SENT'|'QUEUED'|'FAILED',
   whatsapp: ... }`) di respons (non-fatal), dan catat `console.warn` bila gagal.
2. **Email config:** `EMAIL_FROM` harus domain terverifikasi. Karena pengguna
   belum yakin, gunakan **placeholder di `.env.local`** yang jelas
   (`EMAIL_FROM=E-PerformIQ <no-reply@your-domain.example>`) + komentar, dan
   pastikan `fromAddress()` memakai `EMAIL_FROM`. Dokumentasikan di README.
3. **Diagnostik:** tambah endpoint/atau perluas yang ada agar bisa melihat
   status outbox terakhir (`GET /api/v1/careers/notifications/health` → provider
   aktif + 5 entri outbox terakhir beserta status/error). Berguna untuk
   `systematic-debugging`.
4. **Verifikasi:** uji dengan kredensial nyata (Fonnte token aktif; Resend
   domain terverifikasi) — pengguna yang menyediakan. Kode menjamin: pesan
   benar-benar dikirim atau status `FAILED` + `error` terlihat, bukan senyap.

**Non-tujuan:** membuat provider jadi wajib. Tetap best-effort (kegagalan
notifikasi tidak menggagalkan lamaran).

### F4 — Ganting tes pada status `SCREENING`

Aturan: kandidat hanya boleh **memulai** tes (psikometri/teknis) bila
`job_applications.status ∈ {SCREENING, INTERVIEW, OFFERED, HIRED}`
(yaitu `SUBMITTED` = belum boleh; `REJECTED` = tidak boleh).

Implementasi:
- `assessmentService.startAttempt(db, ...)`: setelah `resolveCandidateContext`,
  baca status lamaran; bila `SUBMITTED`/`REJECTED` → `ForbiddenError`
  ("Tes belum dibuka. Menunggu seleksi HR.").
- Route `POST /api/v1/careers/assessments/start` meneruskan error via
  `problem()` → 403 dengan pesan jelas.
- UI `src/app/careers/portal/assessments/page.tsx`: tampilkan banner terkunci +
  nonaktifkan tombol mulai bila status belum `SCREENING`; tampilkan status
  terkini dari timeline.

**Tes:** unit/integrasi — start ditolak saat `SUBMITTED`, diizinkan saat
`SCREENING`.

### F5 — HR: link meeting + tandai selesai; kandidat lihat link

**Backend (sudah ada, minor):**
- `POST /api/v1/recruitment/interviews` (ada) — buat jadwal + `meetingUrl`.
- `PATCH /api/v1/recruitment/interviews/[id]` (**tambah**) — set
  `status='DONE'` (dan/atau `'CANCELED'`), plus `score`/`notes` opsional.
  RBAC `recruitment:manage`. Setelah DONE → `syncApplicationTimeline()` +
  `notifyStageChange` (otomatis via upsert).

**UI HR baru — `src/components/governance/InterviewSchedulerPanel.tsx`:**
- Pilih lamaran (dari `GET /api/v1/recruitment/candidates`, filter status
  `SCREENING`/`INTERVIEW`).
- Form: `scheduledAt` (datetime), `durationMinutes`, `interviewerUserId`
  (opsional), **`meetingUrl`** (input manual).
- Tombol **"Buat / Generate Ruang"** (opsional): bila provider dikonfigurasi,
  panggil endpoint generate; jika tidak → pesan informatif (tetap manual).
  *(Provider generate = follow-up bila belum ada; default: manual.)*
- Daftar jadwal per lamaran (`GET .../interviews?applicationId=`), tombol
  **"Tandai Selesai"** (`PATCH ... DONE`).
- Setelah membuat jadwal, **status lamaran → `INTERVIEW`** (otomatis, agar
  timeline + notifikasi konsisten). Dikontrol lewat `PATCH status`.
- Mount panel di `src/app/dashboard/hr-command/page.tsx` (dekat
  `RecruitmentPanel`).

**Kandidat:** timeline `/careers/status` (sudah menampilkan `meetingUrl`,
`meetingUrl`/`scheduledAt`/`interviewerName` dari WS-5 Task 1) + portal kandidat
`/careers/portal` menunjukkan kartu **"Jadwal Wawancara"** berisi tanggal, jam,
interviewer, dan tautan. Tambahkan blok serupa di portal (bukan hanya /status).
In-app notification + email/WA saat jadwal dibuat & saat DONE (lewat
`notifyStageChange`).

**Uji:** integrasi — buat jadwal → status INTERVIEW + timeline INTERVIEW
`SCHEDULED` + `meetingUrl`; PATCH DONE → timeline INTERVIEW `PASSED`.

### F6 — Kendali status HR lengkap

Panel `RecruitmentPanel.tsx` (sudah ada dropdown status) diperluas agar tiap
transisi jelas dan **memicu notifikasi**:
- `SUBMITTED → SCREENING`: buka akses tes (F4) + notifikasi "masuk seleksi".
- `SCREENING → INTERVIEW`: lewat pembuatan jadwal (F5) + notifikasi link.
- `→ OFFERED`: notifikasi penawaran.
- `→ HIRED`: notifikasi penerimaan (final).
- `→ REJECTED`: notifikasi penolakan (sopan).
- Semua transisi memakai `PATCH /api/v1/recruitment/candidates/[id]/status`
  (ada) + `recordDecision` (ada) untuk OFFERED/REJECTED.
- Perbaiki celah notifikasi: `upsertStage` hanya menotifikasi saat status
  timeline berubah; untuk transisi yang tidak mengubah stage (mis. OFFERED→
  HIRED keduanya `DECISION`), tambah pemanggilan `notifyStageChange` eksplisit
  dari `updateApplicationStatus`/`recordDecision` dengan `note` yang sesuai.

## 5. Skema DB

**Tidak ada perubahan skema wajib.** `interview_schedules` sudah punya
`meeting_url`, `status`, `scheduled_at`, `interviewer_user_id`, `score`,
`notes`. Bila "generate ruang" butuh menyimpan metadata provider, gunakan kolom
`notes` yang ada (tanpa migrasi). Bila ternyata perlu kolom baru → **migrasi
aditif** + ADR (catat di plan).

## 6. Alur End-to-End (target)

```
Kandidat isi lamaran → submit
  → dapat applicationNo + notifikasi in-app/email/WA  (F3)
  → status SUBMITTED (tes TERKUNCI)                    (F4)
HR ubah status → SCREENING  → notifikasi "masuk seleksi" (F6)
  → kandidat membuka tes (psikometri & teknis)         (F4)
  → kandidat selesai → hasil tersimpan                 (existing)
HR review hasil → buat jadwal + link meeting           (F5)
  → status INTERVIEW + notifikasi link ke kandidat
  → kandidat lihat link di portal & /careers/status    (F5)
Interview selesai → HR "Tandai Selesai" → INTERVIEW DONE (F5)
HR → OFFERED / HIRED / REJECTED + notifikasi           (F6)
```

## 7. Rencana Pengujian

- **Unit:** gating `startAttempt` (SUBMITTED ditolak, SCREENING diizinkan);
  normalisasi nomor WA; pemetaan notifikasi transisi.
- **Integrasi:** buat jadwal interview (link + status/timeline + notifikasi);
  PATCH interview DONE; transisi status OFFERED/HIRED/REJECTED memicu notifikasi;
  outbox email/WA terisi dengan status benar.
- **Browser:** F1 (teks terlihat), F2 (paritas menu), F5 (HR buat link → kandidat
  lihat link).
- **Suite penuh:** `npm run db:reset` lalu `vitest run`; `npm run build`.

## 8. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Provider email/WA tetap gagal tanpa kredensial valid | Surface status di outbox + health endpoint; dokumen README; non-fatal |
| Deterministic `application_no` (email+posting+tanggal) menimpa lamaran ulang | Di luar lingkup; catat sebagai follow-up |
| Notifikasi terlewat saat transisi tanpa perubahan stage | Panggil `notifyStageChange` eksplisit (F6) |
| Ganting tes mengganggu alur lama (kandidat sudah tes) | Gating hanya menolak start baru; attempt lama tetap bisa disubmit |
| "Generate ruang" butuh integrasi pihak ketiga | Default manual; tombol generate opsional/bertahap |

## 9. Kriteria Sukses

1. Teks di semua kolom login/register terlihat jelas.
2. Menu karyawan secara visual konsisten dengan menu utama.
3. Submit lamaran → email & WA benar-benar terkirim (dengan kredensial valid),
   atau status `FAILED`+error terlihat (bukan senyap), dan kandidat melihat kode
   status + notifikasi in-app.
4. Kandidat tidak bisa mulai tes sebelum `SCREENING`; bisa setelahnya.
5. HR dapat membuat link meeting, kandidat melihatnya, HR menandai selesai.
6. `OFFERED`/`HIRED`/`REJECTED` dapat diubah HR dan memicu notifikasi.
7. Suite penuh hijau + build sukses.

## 10. Pertanyaan Terbuka (tidak menghambat)

- Alamat `EMAIL_FROM` final (placeholder sampai pengguna menyetel domain).
- Apakah "generate ruang" otomatis diperlukan sekarang atau cukup manual.
