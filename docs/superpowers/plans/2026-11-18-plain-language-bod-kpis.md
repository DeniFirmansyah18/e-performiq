# Bahasa KPI BOD yang Jelas dan Pintasan Suksesi — Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti istilah KPI BOD yang berbelit dengan bahasa Indonesia yang mudah dipahami, memastikan saran KPI dari AI/fallback juga lugas, dan menghapus hanya pintasan suksesi dari navbar tanpa menghilangkan akses dari kartu BOD.

**Architecture:** Perbarui label pilar yang ditanam di seed serta sediakan migrasi idempoten untuk mengganti dua label lama pada data tersimpan tanpa mengubah ID, perspektif, bobot, deskripsi, atau relasi pilar. Sederhanakan arahan dan fallback generator KPI agar nama dan alasan usulan tidak memantulkan jargon; pertahankan nama pilar database yang tepat sebagai `pillarName` untuk identifikasi dan persetujuan. Ubah judul kartu BOD dan hilangkan hanya item navigasi suksesi.

**Tech Stack:** Next.js, TypeScript, SQL migrations, Vitest, PGlite integration tests.

**Spec:** Dokumen ini menetapkan spesifikasi dan rencana implementasi.

## Global Constraints

- Gunakan label persis `Kepuasan Stakeholder & Keunggulan Layanan Ekosistem` → `Pelayanan yang Memuaskan.`
- Gunakan label persis `Keunggulan Operasional & Zero Fatal SOP Compliance` → `Proses Kerja Tertib dan Andal.`
- Ganti judul kartu BOD `Kesiapan Calon Pemimpin` menjadi `Peta Talenta & Suksesi`; pertahankan tautan dan aksesnya melalui kartu.
- Hapus hanya pintasan navbar BOD `Peta Talenta & Suksesi` (`/dashboard/ninebox-matrix`); jangan menghapus halaman, route, konten kartu, atau akses lain.
- Bahasa untuk nama dan alasan KPI yang dihasilkan harus berupa Bahasa Indonesia umum, langsung, singkat, tanpa jargon; jangan mengubah target, satuan, bobot, atau validasi data.
- Pertahankan label pilar lengkap yang disetujui sebagai `pillarName` pada objek KPI, untuk pemetaan dan operasi persetujuan.
- Migrasi harus aman diulang dan hanya mengganti nilai label lama yang tepat pada perspektif terkait; jangan mengubah pilar khusus pengguna dengan nama lain.
- Jangan mulai mengubah kode aplikasi, seed, migrasi, atau tes sebelum pengguna menyetujui rencana ini.

## Keputusan desain dan cakupan

1. **Pilar tampilan/data:** CUSTOMER memakai label persis `Pelayanan yang Memuaskan.` dan INTERNAL_PROCESS memakai `Proses Kerja Tertib dan Andal.`. Label baru diterapkan pada baris seed baku serta baris yang sudah tersimpan, dipilih berdasarkan perspektif dan nama lama yang persis. Deskripsi seed saat ini tetap utuh—teks deskripsi bukan bagian dari perubahan label yang diminta.
2. **Usulan KPI:** Fallback memberi nama sederhana untuk semua perspektif seed baku: FINANCIAL `Pertumbuhan Pendapatan dan Penggunaan Anggaran yang Hemat`; CUSTOMER `Pelayanan yang Memuaskan`; INTERNAL_PROCESS `Proses Kerja Tertib dan Andal`; LEARNING_GROWTH `Kemampuan dan Budaya Kerja Karyawan`. Alasan fallback yang tepat: FINANCIAL `Mengukur pertumbuhan pendapatan dan penggunaan anggaran yang hemat.`; CUSTOMER `Mengukur apakah pengguna layanan merasa puas.`; INTERNAL_PROCESS `Mengukur apakah pekerjaan selesai dengan tertib dan sesuai aturan.`; LEARNING_GROWTH `Mengukur peningkatan kemampuan dan budaya kerja karyawan.`. Untuk pilar khusus di luar perspektif seed, gunakan nama netral `Hasil pada pilar ini` dan alasan `Mengukur hasil yang dicapai pada pilar ini.` Prompt AI secara eksplisit meminta bahasa Indonesia umum dan melarang jargon/istilah asing yang tidak perlu dalam nama KPI maupun alasan. AI tetap harus menulis nama pilar persis untuk `pillarName`.
3. **Navigasi BOD:** Kartu executive boardroom menjadi pintasan yang ditampilkan dengan judul `Peta Talenta & Suksesi`; menu navbar tidak lagi menampilkan tautan ke 9-Box bagi BOD. Route tetap dapat diakses melalui kartu dan navigasi lain yang telah ada.
4. **Di luar cakupan:** Mengubah target KPI, template KPI jabatan, seluruh istilah HR lain, terjemahan label perspektif BSC/enum teknis, pembaruan deskripsi pilar, atau menghapus/menutup route 9-Box.

## File dan tanggung jawab

- `src/lib/db/seed/index.ts` — sesuaikan dua label pilar dalam seed baku; karena seed menggunakan `ON CONFLICT (id) DO NOTHING`, perubahan seed saja tidak memperbarui data yang sudah ada.
- `src/lib/db/migrations/00NN_plain_language_bod_pillars.sql` — migrasi idempoten untuk memperbarui pasangan nama lama berdasarkan perspektif yang cocok; nomor final mengikuti migrasi tertinggi yang ada pada saat implementasi.
- `src/lib/services/kpiGeneratorAiService.ts` — helper internal untuk memilih nama/alasan fallback yang mudah dipahami dan instruksi bahasa pada prompt AI; pertahankan kunci `pillarName` sesuai nilai database dan jangan ubah kontrak output.
- `src/components/navigation/NavMenu.tsx` — hapus item navbar BOD untuk Peta Talenta & Suksesi saja.
- `src/app/dashboard/executive/page.tsx` — ganti teks judul kartu BOD dengan label yang disetujui, tanpa mengubah `href` atau aksi.
- `src/components/charts/RadarChartBSC.tsx` — ganti contoh driver proses berbahasa jargon dengan frasa Indonesia yang mudah dipahami, untuk mencegah contoh visual tetap bertentangan dengan penyederhanaan.
- `tests/unit/kpiGenerator.test.ts` — tes nama dan alasan fallback yang sederhana, serta keberlanjutan identitas `pillarName`.
- `tests/ui/nav-roles.test.tsx` — tegaskan BOD tetap melihat Ruang Eksekutif saja pada navbar dan tidak melihat pintasan 9-Box; tes kartu memvalidasi label serta akses tetap tersedia.
- `tests/ui/board-executive.test.tsx` — cakupan judul baru kartu dan tautan/aksi kartu yang sudah ada.
- Tes migrasi yang baru atau tes integrasi DB terdekat — pastikan data dengan nama lama diperbarui, pilar lain tidak berubah, dan migrasi bisa dijalankan ulang. Pilih pola test migrasi yang telah dipakai repo saat implementasi.

## Review Focus

- Label baru harus identik termasuk tanda baca dengan persetujuan pengguna dan hanya diterapkan pada dua pilar/perspektif yang dituju.
- Migrasi harus membatasi perubahan menggunakan pasangan `(perspective, pillar_name lama)`; jangan mengubah deskripsi atau ID karena keduanya mempertahankan relasi/identitas data.
- Rekomendasi AI harus tetap bisa dicocokkan oleh `sanitasiUsulan` ke nama pilar aktual; bahasa sederhana berlaku untuk nama KPI/alasan, bukan mengubah nilai `pillarName` yang menjadi kunci pilar.
- Penghapusan navigasi hanya untuk navbar; kartu dan route harus tetap berfungsi.
- Tidak boleh ada perubahan target, satuan, bobot atau aturan sanitasi KPI.

## Rencana implementasi berurutan (TDD)

### Tugas 1 — Buat tes karakterisasi generator KPI

**Berkas:** `tests/unit/kpiGenerator.test.ts`, `src/lib/services/kpiGeneratorAiService.ts`.

- [ ] Tambahkan tes fallback untuk empat perspektif seed: CUSTOMER bernama `Pelayanan yang Memuaskan`, INTERNAL_PROCESS `Proses Kerja Tertib dan Andal`, FINANCIAL `Pertumbuhan Pendapatan dan Penggunaan Anggaran yang Hemat`, dan LEARNING_GROWTH `Kemampuan dan Budaya Kerja Karyawan`; alasan mengikuti kalimat tepat yang tercantum pada keputusan desain.
- [ ] Tambahkan tes bahwa pilar kustom menerima nama netral `Hasil pada pilar ini` dan alasan netral yang dirinci di atas, sehingga tidak memantulkan istilah jargon dari input.
- [ ] Tegaskan `pillarName` tetap menyalin nama pilar input persis, sementara target, satuan, bobot tetap sesuai perilaku yang berlaku.
- [ ] Jalankan `npm test -- --run tests/unit/kpiGenerator.test.ts` dan pastikan tes baru gagal sebelum implementasi.
- [ ] Implementasikan fungsi pemetaan nama/alasan fallback, dan tambahkan arahan pada prompt AI untuk bahasa Indonesia umum tanpa jargon serta nama/alasan yang mudah dimengerti.
- [ ] Jalankan tes unit generator hingga lulus.

### Tugas 2 — Perbarui label baku dan data yang sudah tersimpan

**Berkas:** `src/lib/db/seed/index.ts`, migrasi `src/lib/db/migrations/00NN_plain_language_bod_pillars.sql`, tes migrasi/integrasi DB.

- [ ] Ubah hanya dua nilai `pillar_name` pada baris seed CUSTOMER dan INTERNAL_PROCESS ke label baru yang tepat.
- [ ] Tambahkan migrasi bernomor berikutnya dengan dua `UPDATE` terpisah atau satu `UPDATE` terikat pasangan perspektif/nama lama; tiap klausa hanya mencocokkan nilai lama persis dan perspektif yang dimaksud.
- [ ] Tulis tes yang membuktikan dua label lama diganti, baris pilar lain tidak berubah, dan menjalankan migrasi lagi tidak membuat perubahan tambahan.
- [ ] Jalankan tes migrasi terpilih dan tes seed Boardroom yang relevan.

### Tugas 3 — Ubah akses navigasi dan judul kartu BOD

**Berkas:** `src/components/navigation/NavMenu.tsx`, `src/app/dashboard/executive/page.tsx`, `tests/ui/nav-roles.test.tsx`, `tests/ui/board-executive.test.tsx`.

- [ ] Ubah tes navbar BOD agar memastikan tautan Ruang Eksekutif tetap ada, tautan Peta Talenta & Suksesi/9-Box tidak ada, dan jumlah tautan sesuai satu.
- [ ] Perbarui judul tes kartu untuk `Peta Talenta & Suksesi` dan pastikan tautan/aksi ke route yang telah dipakai kartu tetap tersedia.
- [ ] Jalankan tes UI terkait dan pastikan tes gagal sebelum perubahan implementasi.
- [ ] Hapus hanya entri `Peta Talenta & Suksesi` dari `NAV_ITEMS`; jangan ubah route atau kartu.
- [ ] Ganti hanya judul kartu `Kesiapan Calon Pemimpin` menjadi `Peta Talenta & Suksesi` dan jalankan tes UI terkait.

### Tugas 4 — Hilangkan jargon dari contoh grafik dan lakukan verifikasi

**Berkas:** `src/components/charts/RadarChartBSC.tsx` dan verifikasi lintas fitur.

- [ ] Ganti contoh `Zero Fatal SOP Error & SLA Speed` dengan driver proses yang menyatakan maksudnya dalam Bahasa Indonesia umum, misalnya `Ketepatan proses kerja dan penyelesaian layanan`.
- [ ] Cari kemunculan frasa lama dan label lama yang berada dalam cakupan layar/komponen ini; pastikan tidak tersisa pada titik-titik yang dimaksud (fixture test yang sengaja menguji kompatibilitas dapat mempertahankan data lama dengan komentar).
- [ ] Jalankan seluruh tes relevan, lalu `npm test -- --run` dan `npm run build`.
- [ ] Tinjau diff untuk memastikan perubahan hanya mencakup spesifikasi ini; laporkan hasil tes/build yang benar-benar dijalankan.

## Validasi penerimaan

- Seed baru dan basis data yang dimigrasikan menampilkan label pilar yang telah disepakati persis.
- Generator fallback dan AI (melalui instruksi prompt) menggunakan Bahasa Indonesia sederhana pada `kpiName` dan `rationale`; identitas pilar serta aturan KPI tidak berubah.
- Navbar BOD hanya menampilkan `Ruang Eksekutif (CEO)`; kartu executive boardroom tetap menjadi akses dengan judul `Peta Talenta & Suksesi`.
- Tes relevan dan seluruh suite/build lulus.
