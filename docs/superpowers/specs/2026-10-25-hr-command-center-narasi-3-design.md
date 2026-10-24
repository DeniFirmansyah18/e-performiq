# Spec — Command Center HRD (Revisi Narasi 3)
**Tanggal:** 2026-10-25
**Status:** Menunggu Review
**Klasifikasi:** Architectural (Penyempurnaan Command Center HRD dengan 7 Kapabilitas Narasi 3)
**Rujukan:** PRD `PRD_Sistem_Penilaian_Karyawan (PT).md`, UU Cipta Kerja No. 6/2023, PP No. 35/2021, ISO 30414

---

## 1. Latar Belakang & Tujuan
Sesuai arahan owner pada **Revisi Bentuk Narasi 3**, Command Center HRD (`/dashboard/hr-command`) disempurnakan menjadi pusat kendali tunggal (*Single Pane of Glass*) yang memungkinkan HRD memantau, menganalisis, mengelola, mengontrol siklus kerja, dan mengambil keputusan strategis secara terintegrasi dengan kinerja perusahaan.

### 7 Pilar Utama Kebutuhan Narasi 3
1. **Aktivitas Kepegawaian Menyeluruh:** Visibilitas real-time log aktivitas pegawai (presensi, KPI, lembur, perizinan, mutasi, promosi, offboarding).
2. **Analitik Kepegawaian Komprehensif:** Distribusi nilai performa, 9-box talent matrix, flight risk/burnout prediction, dan indeks keselarasan visi-misi (VMAI).
3. **Manajemen Kepegawaian Strategis:** Total headcount, sebaran departemen, rasio gender/usia/grade, ringkasan capaian KPI, dan pemenuhan MPP (Manpower Planning).
4. **Pencatatan & Analisis Beban Kerja Berbasis Satuan Waktu:** Utilisasi jam kerja dari timesheet dan entri KPI harian, Workload Intensity Score, deteksi underwork vs overwork.
5. **Rekomendasi Tindakan HRD & Peta Jenjang Karir:** Action items otomatis berbasis aturan bisnis (kontrak PKWT mendekati jatuh tempo, workload anomali, suksesi), serta penuntun jalur karir pegawai (career ladder guidance).
6. **Kontrol Siklus Hidup Pegawai 3-Fase:** Kontrol operasional sebelum bekerja (pre-hire/onboarding), saat bekerja (during-employment), dan setelah bekerja (offboarding).
7. **Pencarian Cepat, Detail Pegawai, Kontrak PKWT & Hubungan ke Performa Perusahaan:** Pencarian instan profil pegawai, filter kontrak PKWT (aktif, <30 hari, <60 hari, kedaluwarsa), dan kontribusi performa individual ke pilar strategis BSC perusahaan.

---

## 2. Arsitektur Komponen & Data Flow

### 2.1 Tab Layout Command Center (`/dashboard/hr-command`)
Antarmuka dibagi menjadi 5 tab kerja terpadu:
1. **Ringkasan & Analitik Eksekutif (`overview`):**
   - KPI metric cards (Headcount, Average Performance, Average Workload, Open Actions).
   - Cost of Workforce & Attrition/Flight Risk Heatmap.
   - Distribusi Performa (Gaussian Bell Curve) & 9-Box Matrix Quick Status.
2. **Kontrol Siklus Hidup (`lifecycle`):**
   - **Pra-Kerja:** MPP pipeline, rekrutmen, tes teknis/psikometri, verifikasi dokumen, onboarding 30-60-90 fit.
   - **Saat-Kerja:** Presensi harian, verifikasi KPI harian, timesheet, persetujuan cuti & lembur, payroll.
   - **Pasca-Kerja:** Inisiasi offboarding, serah terima aset & knowledge handover, clearance multi-departemen, pesangon PP 35/2021.
3. **Analisis Beban Kerja & Waktu (`workload`):**
   - Agregasi jam kerja harian/mingguan pegawai dari `daily_timesheets`.
   - Workload Intensity Index: Rasio jam tercatat terhadap kapasitas standar (40 jam/minggu).
   - Identifikasi over-capacity (potensi burnout) dan under-capacity (distribusi beban tidak merata).
4. **Panduan Karir & Rekomendasi HRD (`career-actions`):**
   - Action Recommendation Engine: Kartu tindakan prioritas (High/Medium/Low) dengan one-click action.
   - Career Ladder Navigator: Matrix posisi asal -> posisi target, syarat masa kerja, GPA, dan skill gap.
5. **Direktori Pegawai & Manajemen PKWT (`directory`):**
   - Filter cepat status pegawai: Tetap, PKWT Aktif, PKWT Expiring <30 Hari, PKWT Expiring <60 Hari, Expired.
   - Detail modal pegawai: Profil lengkap, riwayat performa, beban kerja, dan pemetaan ke pilar BSC perusahaan.

---

## 3. Spesifikasi Teknis & Endpoint API

### 3.1 Endpoint Baru / Penyempurnaan
1. `GET /api/v1/hr/workload-summary`
   - Parameter query: `departmentId` (opsional), `period` (weekly/monthly, default: monthly), `date` (YYYY-MM).
   - Response: Statistik beban kerja per departemen, rata-rata jam kerja, daftar pegawai dengan rasio beban kerja tertinggi dan terendah.
2. `GET /api/v1/hr/action-recommendations`
   - Response: Daftar rekomendasi tindakan otomatis:
     - PKWT mendekati habis (<30 hari, <60 hari).
     - Overload kerja (>45 jam/minggu konsisten 2 minggu).
     - Karyawan berpotensi tinggi (Top Box 9-Box) yang memenuhi syarat promosi jenjang karir.
     - Dokumen onboarding/offboarding pending approval >3 hari kerja.
3. `GET /api/v1/hr/contracts-summary`
   - Response: Total PKWT aktif, jumlah PKWT expiring <30 hari, <60 hari, rasio konversi PKWT ke Tetap.
4. `GET /api/v1/hr/career-guidance/:employeeId`
   - Response: Posisi saat ini, opsi jenjang karir berikutnya berdasarkan `career_path_levels`, persentase kesiapan (masa kerja, nilai KPI, riwayat pelatihan LMS).

---

## 4. Rencana Pengujian & Verifikasi (Test Strategy)
1. **Unit & Integration Test:**
   - Test kalkulasi beban kerja (Workload Intensity Index) pada `workloadService`.
   - Test filter batas waktu PKWT dan penentuan status alert (<30 hari, <60 hari) pada `contractRepository/Service`.
   - Test rule engine rekomendasi tindakan HRD pada `hrActionRecommendationService`.
   - Test evaluasi kualifikasi promosi karir terhadap `career_path_levels`.
2. **E2E & UI Test:**
   - Memastikan navigasi tab pada `/dashboard/hr-command` memuat seluruh 5 bagian tanpa error.
   - Verifikasi interaksi modal detail pegawai dan filter PKWT.

---

## 5. Mitigasi Risiko & Kompatibilitas
- **Kompatibilitas Backward:** Seluruh komponen governance yang sudah ada (`CostOfWorkforceCard`, `FlightRiskHeatmap`, dll.) tetap berfungsi dan ditata rapi dalam tab `overview`.
- **Integritas Data:** Perhitungan beban kerja tidak mengubah tabel dasar, melainkan membaca data dari `daily_timesheets` dan `kpi_daily_entries` yang sudah tervalidasi.
- **Audit Logging:** Setiap tindakan yang dipicu dari rekomendasi HRD (misal: perpanjangan kontrak atau persetujuan promosi) dicatat ke dalam `audit_logs` dengan hash chaining yang utuh.
