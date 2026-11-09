# Desain — Penyederhanaan Peran, Hapus Audit & Kalibrasi

**Tanggal:** 2026-11-09
**Status:** Menunggu persetujuan
**Rencana:** `docs/superpowers/plans/YYYY-MM-DD-sederhana-peran.md`

## 1. Maksud & alasan

Pemilik produk memutuskan aplikasi disederhanakan: peran dikurangi menjadi lima,
satu modul dihapus, dan navigasi diratakan. Tujuannya agar menu dan fitur tampil
langsung sesuai kategori, tanpa lapisan grup yang menyembunyikan isi.

## 2. Keputusan pemilik produk

| # | Permintaan | Keputusan |
|---|---|---|
| 1 | Hapus modul audit | **Hapus semuanya** — halaman, endpoint integritas, tesnya |
| 2 | Hapus kalibrasi penilaian | **Hapus total** — `PUT /calibrate`, `is_calibrated` dari logika, seluruh UI; data lama ikut tidak terkunci |
| 3 | Hapus peran AUDITOR | Dilepas dari kode, RBAC, navigasi, seed |
| 4 | Super Admin | Hanya panel akun di menu; **izin `user:manage` dan akses API penuh tetap** |
| 5 | Menu datar | Semua menu satu deret top-level, tanpa grup "Portals"/"Modul & Tata Kelola" |

Peran akhir: `SUPER_ADMIN`, `BOD`, `HR_MANAGER`, `PEOPLE_MANAGER`, `EMPLOYEE`.

## 3. Tujuan

- Hanya lima peran yang dapat dipilih/di-seed; tidak ada akun AUDITOR baru.
- Navigasi tidak lagi memakai dua dropdown; setiap menu adalah tautan top-level.
- Kalibrasi tidak ada lagi di UI maupun logika; nilai selalu dihitung ulang
  oleh yang berhak tanpa status kunci.
- Super Admin masuk dan langsung melihat panel hak akses.

## 4. Bukan tujuan

- **Tidak** mengubah rumus GPA/9-Box.
- **Tidak** menghapus tabel `audit_logs` maupun trigger immutability-nya: pencatatan
  log tetap berjalan (dipakai login, profil, penugasan manajer, board analysis).
  Yang dihapus adalah **halaman & endpoint pemeriksaannya**, serta hash chain.
- **Tidak** menghapus nilai `AUDITOR` dari tipe enum PostgreSQL (lihat §7).

**Anti-tujuan:** aplikasi menjadi tidak bisa dipulihkan bila data salah. Karena
AUDITOR hilang dan panel audit hilang, tidak ada lagi UI untuk memeriksa riwayat
perubahan. Ini diterima pemilik produk secara sadar.

## 5. Rincian perubahan

### 5.1 Hapus modul audit
- Hapus halaman `src/app/dashboard/audit-governance/page.tsx` dan seluruh rutenya
  dari `middleware.ts`.
- Hapus `src/app/api/v1/audit/integrity/route.ts` beserta `verifyAuditChain`.
- Hapus migrasi hash chain pada **kode** (kolom `entry_hash`/`prev_hash` tetap di
  DB agar data lama tidak rusak; penulisan hash dihentikan).
- Hapus `tests/api/audit-integrity.test.ts` (dan bagian terkait di tes lain).
- **Pertahankan** `insertAuditLog` dan `audit_logs` — dipakai login, logout,
  profil, penugasan manajer, flight-risk recompute, board analysis.
- Pertahankan `src/app/api/v1/governance/audit-logs/route.ts`? → **Hapus.**
  Diverifikasi: satu-satunya pemanggilnya adalah `audit-governance/page.tsx:79`
  yang ikut dihapus. Tidak ada UI lain yang memakainya.

### 5.2 Hapus kalibrasi
- Hapus `src/app/api/v1/performance/appraisals/[id]/calibrate/route.ts`.
- `appraisalService.calculateAndSaveGPA`: buang parameter `approve`, blok
  `ForbiddenError`, dan panggilan `setAppraisalCalibrated`. Nilai selalu
  dihitung + disimpan; **blokir baris terkunci juga dibuang** (sesuai keputusan:
  data lama tidak lagi terkunci).
- `appraisalRepository`: hapus `setAppraisalCalibrated`; kolom `is_calibrated`
  tidak lagi dibaca/ditulis.
- `calculate-gpa/route.ts`: hapus skema `approve` & `calibration_notes`.
- UI `ninebox-matrix/page.tsx`: hapus tombol "Kalibrasi Penilaian", modal kalibrasi
  (`Rapat Kalibrasi Penilaian`), state `isCalibrateModalOpen`/`calibForm`/
  `calibrate*Msg`, dan kartu aksi terkait.
- `manager-cockpit/page.tsx`: hapus `approve: false` dari body request.
- RBAC: hapus permission `appraisal:calibrate` (tidak ada lagi pemakainya).
- Seed: `is_calibrated` selalu `FALSE`; hapus data kalibrasi contoh.

### 5.3 Lepas peran AUDITOR
- `src/types/index.ts`: hapus `'AUDITOR'` dari `UserRole`.
- `rbac.ts`: hapus AUDITOR dari seluruh entri matriks (71 kemunculan di 16 berkas
  total; rbac sendiri 22).
- `middleware.ts`: hapus dari `DASHBOARD_ROLES` dan `homeForRole`.
- `scope.ts`: hapus dari `ORG_WIDE_ROLES`.
- `NavMenu.tsx`: hapus dari daftar `roles` tiap menu.
- Seed: akun `bambang.audit@` tidak lagi dibuat sebagai AUDITOR; **hapus akun
  tersebut** dari seed (bukan diubah perannya) agar tidak muncul di panel akun.
- `notificationService`, `faqData`, `UserGuideModal`, `AuthContext`,
  `AccountManagementPanel`, `aiService`, `plainLanguage`, `TermTooltip`: hapus
  rujukan AUDITOR.
- Panel akun: AUDITOR tidak muncul di pilihan peran.

### 5.4 Super Admin hanya panel akun
- `NavMenu`: untuk SUPER_ADMIN hanya tampil "Manajemen Akun".
- `middleware.ts`: SUPER_ADMIN yang membuka segmen lain dialihkan ke
  `/dashboard/account-management`. Pengecualian: segmen tidak ada (404) tetap 404.
- Izin RBAC SUPER_ADMIN **tidak diubah** (tetap penuh), sehingga API tetap bisa
  dipanggil oleh proses internal/administratif.
- `homeForRole('SUPER_ADMIN')` → `/dashboard/account-management`.

### 5.5 Menu datar
- `NavMenu`: ganti dua dropdown (`Portals`, `Modul & Tata Kelola`) menjadi satu
  deret tautan top-level berurut: Manajemen Akun (super admin) · Executive
  Boardroom · HR Ops Command Center · Manager Evaluation Cockpit · Employee Growth
  Portal · 9-Box Talent Matrix · Offboarding & Clearance.
- Menu disaring per peran seperti sekarang; tanpa header grup.
- Pada layar sempit, deret dibungkus (wrap), bukan dropdown.

## 6. Batasan

- Bahasa Indonesia untuk teks yang dilihat pengguna.
- Tidak boleh ada mojibake/BOM (dijaga `nineBoxTextQuality.test.ts`).
- Tidak ada rujukan ke halaman/rute yang dihapus (menu, FAQ, panduan).
- `npx vitest run`, `npm run lint`, `npx tsc --noEmit` wajib bersih.

## 7. Konsekuensi teknis yang diterima

1. **Enum DB tetap memuat `AUDITOR`.** Menghapus nilai enum PostgreSQL berarti
   membuat ulang tipe dan seluruh kolom pemakainya — berisiko pada data yang ada.
   Preseden `0061_remove_assessor_role` melakukan hal yang sama: berhenti dipakai,
   bukan dihapus dari tipe. Bila data lama memuat baris berperan AUDITOR, baris itu
   tetap ada tetapi tidak ada akun yang bisa login dengan peran itu.
2. **Hash chain berhenti ditulis.** Baris lama yang sudah punya `entry_hash` tetap
   ada; baris baru tidak. Tidak ada lagi verifikasi integritas.
3. **Tidak ada jejak audit yang bisa diperiksa lewat UI.** Satu-satunya cara
   memeriksa `audit_logs` adalah query langsung ke database.
4. **Nilai terkunci lama otomatis tidak terkunci** karena `is_calibrated` tidak
   lagi dibaca.

## 8. Data uji setelah perubahan

Akun seed yang tersisa: `admin@` (SUPER_ADMIN), `hendra.gunawan@` (BOD),
`siti.nurhaliza@` (HR_MANAGER), `danu.tech@` (PEOPLE_MANAGER),
`budi.pratama@` (EMPLOYEE). Sandi `enterprise2026`.

## 9. Yang diserahkan ke pelaksana

- Urutan pembersihan rujukan AUDITOR yang tidak terpakai (agar `tsc` tetap hijau).
- Cara menyaring menu datar pada layar sempit.
- Nama berkas tes dan bentuk stub.
