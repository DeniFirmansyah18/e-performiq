# ADR 016 - Registrasi Mandiri Karyawan (self-registration) + Verifikasi Email + Persetujuan HR

Status: Diterima
Tanggal: 2026-10-04

## Konteks

Selama ini akun karyawan hanya dibuat oleh HR/admin (seed atau panel admin).
Untuk mempercepat onboarding dan mengurangi beban HR, karyawan baru perlu dapat
**mendaftar sendiri** dari halaman publik, namun tanpa membuka celah keamanan:
siapa pun tidak boleh otomatis memperoleh akses ke data internal.

Data internal (payroll, penilaian, dokumen) sensitif, sehingga akun hasil
registrasi mandiri **tidak boleh** langsung aktif.

## Keputusan

Registrasi karyawan memakai alur **tiga langkah** ke tabel staging
`employee_registrations` (`src/lib/services/employeeRegistrationService.ts`):

1. **`registerEmployee`** — karyawan mengisi `fullName`, `email`, `password`,
   `phone`, `positionHint`. Password di-hash (`bcryptjs`). Sistem menolak email
   yang sudah ada di `users` **maupun** `employee_registrations`
   (`BusinessRuleError('Email sudah terdaftar.')`). Baris dibuat dengan status
   `PENDING_EMAIL` dan `verify_token` acak (32 byte) + `verify_expires_at` =
   **now + 24 jam**.
2. **`verifyEmployeeEmail(token)`** — token dicocokkan; status berubah
   `PENDING_EMAIL` → `PENDING_APPROVAL`. Kondisi gagal dibedakan:
   `INVALID` (token tak ada), `EXPIRED` (lewat 24 jam), `ALREADY` (sudah
   diverifikasi).
3. **`approveRegistration(id, { approvedBy, departmentId, positionId })`** —
   HR menyetujui, membuat baris `employees` + `users` (idempoten). Baris
   `REJECTED` tidak bisa disetujui.

`listPendingRegistrations(db)` menyajikan antrean `PENDING_APPROVAL`/
`PENDING_EMAIL` ke HR.

## Konsekuensi

- **Permukaan serangan bertambah**: ada halaman publish untuk membuat baris
  staging. Mitigasi: (a) unik email lintas `users`+registrasi; (b) token acak
  256-bit + **kedaluwarsa 24 jam**; (c) **gerbang persetujuan HR** — tanpa
  aksi HR tidak ada baris `users`/`employees`, jadi tidak ada akses.
- Password tidak pernah disimpan mentah (hash bcrypt), termasuk di staging.
- IDOR tidak berlaku: token bersifat rahasia & acak; antrean hanya lewat route
  ber-RBAC (`recruitment`/kepegawaian).
- **Rate limiting DIUNDA.** Registrasi/verifikasi belum dibatasi laju; spam
  pendaftaran masih mungkin (hanya membengkakkan antrean HR). **Ditindaklanjuti
  sebagai follow-up** (token bucket per IP/email; lihat README).
- Semua email memakai infrastruktur notifikasi yang ada (best-effort; `email_outbox`).

## Alternatif yang Ditolak

- **Auto-aktif tanpa approval** — terlalu berisiko untuk sistem HR internal.
- **Undangan (invite-only)** — tidak memenuhi kebutuhan "daftar mandiri".
