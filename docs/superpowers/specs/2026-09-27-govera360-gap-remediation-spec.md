# Spesifikasi Gap Remediation — Arsitektur 6 Kotak Govera360

**Tanggal:** 2026-09-27
**Status:** Menunggu Review & Persetujuan
**Spesifikasi Induk:** `docs/superpowers/specs/2026-09-25-govera360-6-boxes-architecture-spec.md`
**Klasifikasi:** Architectural (brainstorming path) — ARCHITECTURAL

---

## 1. Tujuan

Audit terhadap implementasi Govera360 pada 2026-09-27 membuktikan bahwa **6 kotak hanya terimplementasi sebagian** dan tidak dapat dipakai *end-to-end* oleh pengguna. Spesifikasi ini menutup celah tersebut dengan tetap mempertahankan seluruh acuan resmi: PP No. 35/2021, PP No. 36/2021 jo PP No. 51/2023, ISO 30414:2019, Balanced Scorecard (Kaplan & Norton), 9-Box Talent Matrix, Kurva Gaussian BUMN, dan GCG KNKG (TARIF).

---

## 2. Bukti Audit (Condition of Current State)

Audit dijalankan dengan probe eksekusi nyata, bukan inspeksi permukaan. Setiap klaim di bawah ini memiliki bukti.

### 2.1 Status per Kotak

| Kotak | Tabel | Service | API Route | Seed | UI | Status |
|---|---|---|---|---|---|---|
| 1. Performance Hub | Ada | Ada | 1 dari 3 | Kosong | Sebagian | **Separuh** |
| 2. Learning & Career | Ada | Ada | 1 dari 3 | Kosong | Hardcoded | **Separuh** |
| 3. Talent Acquisition | **Tidak ada** | **Tidak ada** | **Tidak ada** | **Tidak ada** | **Tidak ada** | **Nol** |
| 4. Core HR & GCG | 1 dari 4 | Ada | 1 dari 4 | Kosong | Tidak ada | **Separuh** |
| 5. Payroll & Finance | 1 dari 3 | Ada | 1 dari 3 | Kosong | Sebagian | **Separuh** |
| 6. Helpdesk & WBS | Ada | Ada | 1 dari 3 | Kosong | Sebagian | **Separuh** |

### 2.2 Temuan dengan Bukti

**G-01 — Database dev tidak menjalankan migrasi 0003.**
Probe `submitDailyTimesheet` gagal dengan `relation "daily_timesheets" does not exist`.
*Sudah diperbaiki* pada sesi audit via `npm run db:migrate`. Aturan tetap berlaku: setiap migrasi baru wajib di-migrate sebelum dipakai.

**G-02 — Absensi tidak ada sama sekali.**
Requirement inti Kotak 1 ("terintegrasi langsung dengan data absensi") tidak terpenuhi.
`grep` terhadap `src/**` untuk `attendance|absen|absensi|hadir|presen` hanya menemukan 7 hasil, seluruhnya di dalam teks UI (`FlightRiskHeatmap.tsx`, `faqData.ts`) atau parameter fungsi yang tidak pernah diisi.
Tidak ada tabel attendance. Angka Bradford di `FlightRiskHeatmap` adalah literal hardcoded.

**G-03 — Kotak 3 nol persen.**
`grep` untuk `job_board|internal_mobility|lowongan|interview_schedule|cv_screen` menghasilkan **0 hasil** di seluruh `src/`.
Yang ada (`hiring_requisitions`, `recruitment_assessments`) adalah modul PRD asli, bukan fitur Govera360: tidak ada job board, portofolio lamaran internal, kalender interview mandiri, maupun screening CV.

**G-04 — Mesin "AI" tidak pernah tampil ke pengguna.**
`grep` menemukan **0 pemanggil** untuk `generateTalentRecommendationSignal`, `calculateFlightRisk`, dan `calculateCostOfWorkforce` di luar berkas definisinya. Ketiganya adalah logika mati.

**G-05 — 5 dari 7 tabel Govera360 kosong.**
Seed hanya mengisi 24 tabel basis. `daily_timesheets`, `career_path_levels`, `leave_requests`, `expense_claims`, `helpdesk_tickets` tidak memiliki satu baris pun. Modul Career Path akan menampilkan data dummy atau layar kosong.

**G-06 — Fungsi ada, UI tidak ada.**
`grep` terhadap `src/app/**` menemukan 0 pemanggil untuk `attachKpiEvidence`, `submitExpenseClaim`, dan `createHelpdeskTicket`. Ketiganya tidak terjangkau pengguna.

**G-07 — Analitik masih keyword matching dan data hardcoded.**
- Chatbot `queryPolicyChatbotEngine`: 4 cabang `if (q.includes(...))` statis.
- `CareerPathModal`: array `careerSteps` literal.
- `getVerifiedPayslip`: PIN dibandingkan dengan literal `'123456'`.
- `FlightRiskHeatmap`: array `talents` literal.
- `CostOfWorkforceCard`: angka melalui default parameter.

**G-08 — 0 coverage test untuk jalur database.**
`grep` pada `tests/**` untuk keenam fungsi persistensi menghasilkan **0 hasil**. Semua test Govera360 hanya menguji logika murni. Bug G-01 tidak akan pernah terdeteksi oleh test suite.

---

## 3. Decisions & Rulings

| Topik | Keputusan | Alasan |
|---|---|---|
| Sumber absensi | Tabel `attendance_records` baru, diisi lewat API bertoken mesin (mesin presensi) | Menggantikan angka hardcoded; memenuhi klausul "terintegrasi dengan data absensi" tanpa mengorbankan self-service |
| Zonasi akses data sensitif | `payroll:read`, `attendance:read`, `flight_risk:read`, `wbs:read` sebagai permission RBAC baru | Slip gaji dan WBS adalah data paling sensitif; GCG TARIF mensyaratkan segregasi akses |
| PIN gaji | Hash bcrypt per karyawan, bukan literal | Literal `'123456'` tidak dapat diterima sebagai kontrol akses meski untuk demo |
| LMS Moodle | Lazy LTI-launch URL + tabel katalog lokal | Integrasi LTI penuh memerlukan instance Moodle; katalog lokal memungkinkan SSF-tautan yang benar tanpa infrastruktur eksternal |
| Screening CV | Pencocokan keyword tersusun, bukan LLM | Deterministik, dapat diuji, tidak memerlukan API key; cukup untuk mencocokkan kriteria lowongan |
| Urutan pengerjaan | P0 → P1 → P2, dengan P0 sebagai satu milestone utuh | Absensi adalah fondasi Kotak 1 dan 4; membangun Kotak 3 di atas fondasi yang belum ada akan menghasilkan pekerjaan dua kali |

---

## 4. Cakupan Pekerjaan

### P0-Milestone — Fondasi yang dapat dipakai (Wajib)

**M-1. Tabel absensi & integrasi ke seluruh mesin analitik**
- Tabel baru `attendance_records` dengan batasan PP 35/2021.
- Mesin `computeBradfordFactor` yang menghitung dari data nyata.
- Absensi menjadi input wajib `calculateFlightRisk` (menggantikan parameter hardcoded).

**M-2. Tiga API route analitik yang hilang**
- `GET /api/v1/performance/recommendation-signals`
- `GET /api/v1/governance/flight-risk`
- `GET /api/v1/finance/cost-of-workforce`

**M-3. Seed untuk 7 tabel Govera360 + absensi**
Menghilangkan layar kosong dan membuat setiap fitur dapat didemokan dengan data realistis.

**M-4. UI yang belum terjangkau pengguna**
- Form pengajuan reimbursement (memakai `submitExpenseClaim`)
- Form ticketing & WBS (memakai `createHelpdeskTicket`)
- Upload bukti KPI (memakai `attachKpiEvidence`)
- Mengganti `FlightRiskHeatmap` dan `CostOfWorkforceCard` dari literal ke data API

**M-5. Coverage test jalur database**
Integration test yang memanggil keenam fungsi persistensi ke DB sungguhan. Inilah jaring pengaman yang membuat G-01 tidak terulang.

### P1-Milestone — Melengkapi Kotak 3 dari nol

**M-6. Job Board & Mobilitas Internal**
- Tabel `job_postings`, `internal_applications`, `interview_slots`.
- Alur: karyawan melamar → atasan menyetujui → slot interview → hasil → MOU/dossier.
- Penagihan quota MPP: lamaran yang disetujui tidak boleh melebihi `approved_quota`.

**M-7. Screening CV & Workforce Planning**
- Pencocokan kredensial pelamar dengan `job_positions.competency_dictionary`.
- Perhitungan usulan formasi dari beban kerja division saat ini.

**M-8. UI Job Board di Employee Portal & Approval di Manager Cockpit**

### P2-Milestone — Menuju produksi

**M-9. PIN gaji bcrypt** (menggantikan literal)
**M-10. Lazy LTI launch ke Moodle** + katalog modul nyata
**M-11. Chatbot berbasis basis pengetahuan yang benar** (bukan 4 cabang keyword)

---

## 5. Kriteria Penerimaan (Acceptance Criteria)

| Milestone | Kriteria | Metrik Validasi |
|---|---|---|
| M-1 | `computeBradfordFactor` menghasilkan angka dari data absensi nyata, bukan input manual | 100% perhitungan berbasis query, 0 angka hardcoded di UI |
| M-2 | Ketiga route dapat diakses peran yang sesuai dan menolak peran lain | Uji RBAC: setiap role ditolak/toleransi sesuai matriks |
| M-3 | Setiap halaman Govera360 menampilkan ≥1 baris data dari DB | 0 layar kosong, 0 "fitur belum siap" |
| M-4 | keenam fungsi persistensi dapat dipicu dari UI | Alur manual employee→HR terverifikasi di browser |
| M-5 | Integration test memanggil keenam fungsi ke DB | ≥6 test baru, suite hijau |
| M-6 | Lamaran yang disetujui tidak membuat `hired_count > approved_quota` | 100% penagihan quota |
| M-7 | Screening CV mencocokkan kredensial dengan kriteria jabatan | 100% pelamar dengan kecocokan ≥80% lolos |
| M-9 | PIN salah ditolak; PIN benar memakai verifikasi bcrypt | 100% tolak PIN salah |

---

## 6. Di Luar Cakupan

- Integrasi LTI penuh dengan instance Moodle nyata (P2 M-10 hanya menyiapkan lazy-launch).
- Pembayaran gaji ke bank (slip hanya untuk pembacaan).
- Modul akuntansi umum (double entry). Kotak 5 fokus pada TCOW, bukan pembukuan lengkap.
- Prediksi dengan machine learning. "Analitik AI" di sini adalah aturan deterministik yang dapat diuji — bukan klaim ML.

---

## 7. Pelaksanaan

Mengikuti `superpowers:subagent-driven-development`: satu implementer subagent per task, ditinjau reviewer independen sebelum lanjut ke task berikutnya. Rinciannya pada `2026-09-27-govera360-gap-remediation-plan.md`.
