# Implementation Plan: Penyederhanaan Navigasi & Alur SOP Eksekutif untuk CEO (BOD)

## Overview
Menyederhanakan antarmuka pengguna untuk peran Direktur Utama (CEO / BOD) yang awam sistem informasi. Proyek ini mencakup penataan ulang navigasi atas dengan teks yang jelas dan pintasan langsung ke matriks suksesi talenta, restrukturisasi tab eksekutif sesuai alur SOP 5-langkah pengambilan keputusan korporat, penghapusan jargon teknis rumit yang diganti dengan istilah bisnis intuitif serta kamus tooltip awam, dan verifikasi konektivitas ke database.

## Architecture Decisions
- **NavMenu Top Bar**: Menampilkan teks label eksplisit di samping ikon (bukan hanya ikon persegi kecil) dan menyertakan pintasan langsung ke `/dashboard/ninebox-matrix` khusus role BOD.
- **SOP 5-Step Order**: Tab diurutkan berdasarkan siklus evaluasi manajemen eksekutif:
  1. `overview` (Kesehatan Perusahaan)
  2. `vision` (Strategi & Visi)
  3. `cost` (Biaya & Gaji)
  4. `position-fit` (Peta Talenta & Posisi Kunci)
  5. `activity` (Aktivitas & Kepatuhan Tim)
- **Executive Walkthrough Banner**: Menambahkan visual stepper interaktif di bawah header dashboard untuk memandu CEO pemula langkah demi langkah.
- **Plain-Language & Tooltip Architecture**: Menggantikan akronim kaku (VMAI, BSC, GCG, TARIF, RJMP) dengan bahasa Indonesia lugas disertai atribut title/tooltip penjelasan kontekstual.

## Task List

### Phase 1: Foundation & Navigation
- [x] Task 1: Sederhanakan NavMenu Top Bar & Tambahkan Pintasan 9-Box untuk BOD (`src/components/navigation/NavMenu.tsx`)

### Phase 2: Restrukturisasi Alur SOP & Dashboard Utama
- [x] Task 2: Tata Ulang Urutan & Penamaan Tab Sesuai SOP 5-Langkah (`src/components/executive/BoardTabNav.tsx`)
- [x] Task 3: Perbarui Header, Banner Alur SOP, dan Kartu Metrik di Dashboard Eksekutif (`src/app/dashboard/executive/page.tsx`)

### Checkpoint: Core Navigation Flow
- [x] Navigasi atas dan perpindahan 5 tab SOP berfungsi mulus tanpa error.

### Phase 3: Penyederhanaan Jargon di Panel Eksekutif
- [x] Task 4: Sederhanakan Istilah & Tambahkan Penjelasan pada Panel Rincian (`BoardVisionPanel`, `BoardCostPanel`, `BoardPositionFitPanel`, `BoardActivityPanel`)

### Phase 4: Verifikasi & Dokumentasi
- [x] Task 5: Uji Komprehensif (Lint/Typecheck/Build & Browser Simulation) serta Penyusunan Walkthrough

### Checkpoint: Complete
- [x] Semua kriteria penerimaan terpenuhi.
- [x] Kode terverifikasi bersih dan siap digunakan CEO.

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Query URL tab (`?tab=`) terdampak perubahan urutan tab | Medium | Pertahankan keys internal (`overview`, `vision`, `cost`, `position-fit`, `activity`) sehingga kompatibilitas URL bookmark tetap terjaga 100% |
| Teks menu di bilah atas terlalu panjang di layar kecil | Low | Gunakan kelas responsive Tailwind (`hidden sm:inline` atau truncation teratur) |
| Kerusakan pada role lain di NavMenu | High | Pertahankan logic filter role; hanya sesuaikan label dan item khusus BOD |
