# Task List: Penyederhanaan Navigasi & Alur SOP Eksekutif CEO

## Task 1: Sederhanakan NavMenu Top Bar & Tambahkan Pintasan 9-Box untuk BOD
**Description:** Memperbarui bilah navigasi atas (`src/components/navigation/NavMenu.tsx`) agar menampilkan teks nama menu yang jelas di samping ikon. Menambahkan pintasan langsung ke halaman Peta Talenta & Suksesi (`/dashboard/ninebox-matrix`) untuk role BOD, serta menyederhanakan label menu untuk role lainnya.

**Acceptance criteria:**
- [x] Role BOD melihat dua menu jelas di top bar: "Ruang Eksekutif (CEO)" dan "Peta Talenta & Suksesi"
- [x] Tautan dapat diklik dan aktif sesuai dengan URL yang sedang dibuka
- [x] Label teks tampil jelas dan rapi bersama ikon (responsif di desktop dan tablet)

**Verification:**
- [x] Manual check: verifikasi render HTML NavMenu pada port 3001
- [x] Estimated scope: Small (1 file: `src/components/navigation/NavMenu.tsx`)

---

## Task 2: Tata Ulang Urutan & Penamaan Tab Sesuai SOP 5-Langkah
**Description:** Memperbarui `src/components/executive/BoardTabNav.tsx` agar menyusun tab sesuai alur SOP standar operasional 5-langkah seorang CEO (Overview Bisnis -> Strategi & Visi -> Biaya & Payroll -> Peta Talenta -> Kepatuhan Tim).

**Acceptance criteria:**
- [x] Tab diurutkan: 1. Kesehatan Perusahaan, 2. Arah Strategi & Saran AI, 3. Biaya & Gaji Karyawan, 4. Peta Talenta & Posisi Kunci, 5. Aktivitas & Kepatuhan Tim
- [x] Dilengkapi nomor langkah yang jelas dan tooltip deskripsi fungsi tiap tab
- [x] Active state visual jelas dan kontras

**Verification:**
- [x] Manual check: klik tiap tab pada `http://localhost:3001/dashboard/executive`
- [x] Estimated scope: Small (1 file: `src/components/executive/BoardTabNav.tsx`)

---

## Task 3: Perbarui Header, Banner Alur SOP, dan Kartu Metrik di Dashboard Eksekutif
**Description:** Memperbarui `src/app/dashboard/executive/page.tsx` dengan judul yang ramah pemula, banner stepper alur SOP interaktif, penggantian istilah kaku (VMAI, BSC, GCG, TARIF) menjadi istilah bisnis yang mudah dimengerti, serta penyederhanaan kartu aksi cepat.

**Acceptance criteria:**
- [x] Judul dashboard menjadi "Ruang Kerja Direktur Utama (CEO)" dengan subteks penjelasan
- [x] Terdapat banner pemandu alur 5-langkah SOP yang interaktif (dapat diklik untuk lompat ke tab terkait)
- [x] Kartu metrik utama menggunakan bahasa bisnis sehari-hari dilengkapi balon tooltip
- [x] Kartu aksi cepat menggunakan istilah yang lugas ("Cetak Laporan Rapat Direksi", dll.)

**Verification:**
- [x] Manual check: halaman executive memuat tanpa error dengan data aktual dari database (HTTP 200)
- [x] Estimated scope: Medium (1 file: `src/app/dashboard/executive/page.tsx`)

---

## Checkpoint: Core Navigation Flow
- [x] Seluruh alur navigasi atas dan tab bekerja terintegrasi
- [x] Tidak ada console error di browser / SSR

---

## Task 4: Sederhanakan Istilah & Tambahkan Penjelasan pada Panel Rincian
**Description:** Menyederhanakan bahasa dan menambahkan petunjuk awam pada 4 panel detail eksekutif: `BoardVisionPanel.tsx`, `BoardCostPanel.tsx`, `BoardPositionFitPanel.tsx`, dan `BoardActivityPanel.tsx`.

**Acceptance criteria:**
- [x] `BoardVisionPanel`: Capaian target visi misi dijelaskan dengan angka riil dan istilah lugas
- [x] `BoardCostPanel`: Metrik gaji, lembur, dan BPJS dijelaskan dengan bahasa akuntansi sederhana
- [x] `BoardPositionFitPanel`: Status pemenuhan kualifikasi jabatan diterjemahkan ke bahasa Indonesia yang ramah pemula
- [x] `BoardActivityPanel`: Aktivitas unit kerja dan partisipasi karyawan dijelaskan secara intuitif

**Verification:**
- [x] Manual check: buka masing-masing panel dan pastikan teks mudah dibaca dan data tampil akurat
- [x] Estimated scope: Medium (4 files)

---

## Task 5: Uji Komprehensif & Penyusunan Walkthrough
**Description:** Melakukan pengujian integrasi akhir, memastikan seluruh endpoint API tetap 200 OK, memeriksa build/typecheck TypeScript, dan membuat laporan walkthrough ringkas.

**Acceptance criteria:**
- [x] TypeScript check / build bersih tanpa compile error (`tsc --noEmit` exited code 0)
- [x] Seluruh endpoint BOD merespons dengan data valid (100% 200 OK)
- [x] Dokumen walkthrough tersimpan di artifact directory

**Verification:**
- [x] `rtk node ./node_modules/typescript/bin/tsc --noEmit` (Code 0)
- [x] Pengujian API status dan data rendering
