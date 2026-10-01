# E-PerformIQ â€” Dokumentasi Produk & Panduan Presentasi Client

> **Dokumen ini** berisi: (1) penjelasan aplikasi, (2) langkah demi langkah memulai & mempresentasikan demo, dan (3) acuan resmi/metodologi yang dipakai â€” siap dipakai menghadapi client.
>
> Versi dokumen: 1.0 Â· Tanggal: 1 Oktober 2026 Â· Produk: **E-PerformIQ â€” Enterprise Employee Performance & Lifecycle Analytics**

---

## Daftar Isi
1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Masalah Bisnis yang Diselesaikan](#2-masalah-bisnis-yang-diselesaikan)
3. [Fitur Utama per Peran (Role)](#3-fitur-utama-per-peran-role)
4. [Metodologi & Formula Inti](#4-metodologi--formula-inti)
5. [Arsitektur & Keamanan](#5-arsitektur--keamanan)
6. [Panduan Step-by-Step Memulai Aplikasi](#6-panduan-step-by-step-memulai-aplikasi)
7. [Skenario Presentasi ke Client (Demo Script)](#7-skenario-presentasi-ke-client-demo-script)
8. [Antisipasi Pertanyaan Client (Q&A)](#8-antisipasi-pertanyaan-client-qa)
9. [Acuan Resmi / Referensi](#9-acuan-resmi--referensi)
10. [Lampiran: Akun Demo & Endpoint](#10-lampiran-akun-demo--endpoint)

---

## 1. Ringkasan Eksekutif

**E-PerformIQ** adalah platform manajemen kinerja karyawan **end-to-end** yang mengintegrasikan seluruh siklus hidup karyawan â€” **Pre-Employment â†’ During Employment â†’ Post-Employment** â€” dalam satu sistem terpadu berbasis tata kelola perusahaan yang baik (GCG).

**Nilai jual utama (elevator pitch 30 detik):**

> "E-PerformIQ mengubah manajemen kinerja dari sekadar penilaian tahunan menjadi **mesin keselarasan strategis**. Setiap KPI karyawan tertaut langsung ke Visi-Misi melalui **VMAI (Vision & Mission Alignment Index)**, dihitung dengan formula komposit **GPA 50/20/15/15** yang transparan, dan seluruhnya terekam dalam **audit log immutable** yang siap diaudit. Dari rekrutmen, penilaian, hingga offboarding pesangon PP 35/2021 â€” semuanya dalam satu platform."

**Sorotan produk:**
- ðŸ“Š **7 peran** dengan dashboard khusus (Executive, HR, Manager, Employee, Auditor, Assessor, Super Admin).
- ðŸŽ¯ **Composite GPA** â€” satu skor kinerja tunggal dari 4 komponen terukur.
- ðŸ§­ **VMAI** â€” indeks keselarasan strategis perusahaan dengan benchmark industri.
- ðŸ§© **9-Box Talent Matrix** + pipeline suksesi otomatis.
- ðŸŽ“ **LMS native** (materi kursus, sertifikasi otomatis).
- ðŸ¤– **AI Gemini** untuk analisis per-fitur & agen chat (opsional).
- ðŸ”’ **RBAC + audit immutable** â€” siap GCG/ISO 30414.

---

## 2. Masalah Bisnis yang Diselesaikan

| Masalah Umum Perusahaan | Solusi E-PerformIQ |
|--------------------------|---------------------|
| Penilaian kinerja subjektif & tidak transparan | Formula komposit **GPA** dengan bobot eksplisit (50/20/15/15) & audit trail |
| KPI tidak selaras strategi korporasi | **Cascading BSC 4 level** + **VMAI** sebagai bukti keselarasan |
| Data SDM tersebar (rekrutmen, penilaian, exit) | **Satu platform lifecycle** (Pre/During/Post) |
| Risiko kepatuhan & audit sulit | **Audit log immutable** (trigger PostgreSQL anti-tamper) + RBAC |
| Keputusan suksesi lambat | **9-Box Matrix** + simulasi talent pool otomatis |
| Pelatihan & sertifikasi manual | **LMS native** + sertifikat otomatis terverifikasi publik |

---

## 3. Fitur Utama per Peran (Role)

Aplikasi memiliki **7 peran** dengan akses terpisah (RBAC):

| Peran | Dashboard | Fungsi Inti |
|-------|-----------|-------------|
| **BOD** (Direksi) | Executive Boardroom | VMAI scorecard, 4 perspektif BSC, tren strategis, analitik suksesi |
| **HR_MANAGER** | HR Command Center | MPP & rekrutmen, lifecycle pipeline, LMS, cost & flight-risk, offboarding |
| **PEOPLE_MANAGER** | Manager Evaluation Cockpit | Approve KPI tim, evaluasi GPA, roster, peninjauan lamaran internal |
| **EMPLOYEE** | Employee Growth Portal | Scorecard GPA, sasaran OKR, learning, sertifikat, profil, timesheet, reimburse |
| **AUDITOR** | GCG Audit & Governance | Kepatuhan TARIF, metrik kepatuhan, immutable audit trail |
| **ASSESSOR** | Nine-Box Matrix | Moderasi & kalibrasi nilai, simulasi suksesi, komite penilai |
| **SUPER_ADMIN** | Semua modul | Konfigurasi sistem & manajemen hak akses |

**Modul lintas-peran:**
- **9-Box Talent Matrix** â€” segmentasi Kinerja Ã— Potensi (McKinsey/GE).
- **Offboarding & Clearance** â€” checklist serah terima (hard gate) + kalkulator pesangon PP 35/2021.
- **Public Careers Portal** â€” pelamar eksternal kirim lamaran tanpa login; verifikasi sertifikat publik.
- **AI Assistant** â€” "Analisis AI (Gemini)" per fitur + drawer chat "Tanya AI" (opsional, fallback ramah tanpa API key).

---

## 4. Metodologi & Formula Inti

### 4.1 Composite GPA (Skor Kinerja Individual)
$$\text{GPA} = (50\% \times S_{\text{KPI}}) + (20\% \times S_{\text{SOP}}) + (15\% \times S_{\text{Kompetensi}}) + (15\% \times S_{\text{Core Values}})$$

| Komponen | Bobot | Dasar Penilaian |
|----------|:-----:|-----------------|
| **Cascaded Individual KPI** | **50%** | Realisasi vs target SMART per pilar BSC |
| **SOP & SLA Compliance** | **20%** | Error rate, temuan non-compliance, ketepatan SLA |
| **Competency Mastery** | **15%** | Skill gap analysis (kamus kompetensi Level 1â€“5) |
| **Core Values & 360Â° Feedback** | **15%** | Perilaku kerja (Atasan + Rekan + Bawahan) |

### 4.2 VMAI â€” Vision & Mission Alignment Index
$$VMAI = \sum_{j=1}^{M} W_{P_j} \times \left( \frac{\sum_{i=1}^{N_j} (\text{Achieved KPI}_{i} \times W_{i})}{\sum_{i=1}^{N_j} (\text{Target KPI}_{i} \times W_{i})} \times \text{GCG Compliance Factor}_{j} \right)$$

**Ambang status VMAI:**
- **â‰¥ 95%** â†’ *Exceptional Strategic Alignment* (jalur cepat visi)
- **85% â€“ 94.9%** â†’ *Healthy & Aligned* (best practice industri)
- **70% â€“ 84.9%** â†’ *Sub-Standard / Gap Identified* (perlu koreksi)
- **< 70%** â†’ *Critical Misalignment* (tidak selaras / pelanggaran GCG)

### 4.3 Employee Lifecycle KPI (Ringkas)
- **Pre-Employment:** MPP Alignment Ratio (20%), Quality of Hire, Time-to-Fill SLA (15%), Onboarding 30-60-90 (15%), Probation Success Rate (15%).
- **During-Employment:** 4 komponen GPA di atas.
- **Post-Employment:** Regrettable Attrition (20%), Exit Interview Sentiment (15%), Severance SLA PP 35 (20%), Lifetime Contribution Index (LCI).

---

## 5. Arsitektur & Keamanan

### 5.1 Tumpukan Teknologi
| Lapisan | Teknologi |
|---------|-----------|
| Frontend & Backend | **Next.js 14** (App Router) + React 18 + TypeScript |
| Database | **PostgreSQL** via Drizzle ORM â€” PGlite (lokal) / **Neon Postgres** (produksi) |
| Auth | JWT (`jose`), RBAC + row-level scope |
| AI | Google **Gemini** (REST, server-side, opsional) |
| UI | Tailwind CSS, kartu fitur interaktif |
| Hosting | **Vercel** (serverless) + Neon Postgres |
| Testing | Vitest (60 file, 255 tes) |

### 5.2 Keamanan & Tata Kelola (GCG Compliance)
1. **RBAC** â€” 7 peran dengan izin granular (`assertCan`) + pembatasan data per-scope (`scope.ts`).
2. **Enkripsi** â€” AES-256 at-rest, TLS 1.3 in-transit (produksi).
3. **Immutability** â€” nilai yang sudah dikalibrasi tidak dapat diubah; tercatat di audit log (trigger PostgreSQL anti-tamper, `audit_logs` append-only).
4. **Scope Enforcement** â€” manager hanya melihat bawahan langsung; auditor read-only.

---

## 6. Panduan Step-by-Step Memulai Aplikasi

### Opsi A â€” Jalankan Lokal (untuk demo/verifikasi cepat)

**Prasyarat:** Node.js 18+.

```bash
# 1. Masuk folder proyek
cd "e:\PRD Penilaian Karyawan\Penilaian Karyawan PT"

# 2. Install dependensi
npm install

# 3. Siapkan database lokal (PGlite) + seed data demo
npm run db:reset

# 4. Jalankan aplikasi
npm run dev
# buka http://localhost:3000
```

> **Catatan:** Mode lokal memakai **PGlite** (PostgreSQL in-process) â€” tanpa setup server.

### Opsi B â€” Deploy Produksi (Vercel + Neon Postgres)

**Prasyarat:** akun Vercel + database Neon (atau Vercel Postgres).

```bash
# 1. Set connection string Neon (dari Neon Console â†’ Connection Details)
$env:DATABASE_URL="postgresql://<user>:<pass>@<host>/<db>?sslmode=require"

# 2. Migrasi skema + seed data ke Neon
npm run db:migrate:pg
npm run db:seed:pg
```

**Di Vercel â†’ Project â†’ Settings â†’ Environment Variables:**

| Variabel | Wajib | Nilai |
|----------|:-----:|-------|
| `JWT_SECRET` | âœ… | string acak â‰¥32 karakter |
| `DATABASE_URL` | âœ… | connection string Neon/Pooled |
| `GEMINI_API_KEY` | opsional | kunci Gemini untuk fitur AI |
| `GEMINI_MODEL` | opsional | `gemini-flash-latest` |

Lalu **Redeploy**. Buka `https://<project>.vercel.app`.

> âš ï¸ Vercel serverless tidak bisa menjalankan PGlite (filesystem read-only) â€” `DATABASE_URL` **wajib** di produksi.

### Akun Demo (password seragam: `enterprise2026`)
| Peran | Email |
|-------|-------|
| BOD | hendra.gunawan@eperformiq.co.id |
| HR_MANAGER | siti.nurhaliza@eperformiq.co.id |
| PEOPLE_MANAGER | danu.tech@eperformiq.co.id |
| EMPLOYEE | budi.pratama@eperformiq.co.id |
| AUDITOR | bambang.audit@eperformiq.co.id |
| SUPER_ADMIN | admin@eperformiq.co.id |
| ASSESSOR | aris.assessor@eperformiq.co.id |

> Halaman login menyediakan **quick-login 1-klik** per peran. PIN slip gaji demo: `123456`.

---

## 7. Skenario Presentasi ke Client (Demo Script)

> **Total estimasi: 20â€“25 menit.** Siapkan browser **tidak fullscreen** agar mudah berpindah tab/login.

### Persiapan 5 Menit Sebelum Mulai
1. Pastikan server berjalan (`npm run dev`) dan DB ter-seed.
2. Buka `http://localhost:3000/login` di tab terpisah untuk tiap peran yang akan didemokan, atau login-logout cepat via quick-login.
3. Siapkan slide/halaman dokumen ini sebagai peta jalan.
4. Matikan notifikasi & close tab yang tidak perlu.

### Urutan Demo

**â‘  Pembukaan (2 menit)**
- Tampilkan **halaman Login** â†’ tunjukkan arsitektur **7 peran** + quick-login.
- Narasi: "Satu platform, tiap jabatan punya ruang kerja sendiri dengan hak akses berbeda."

**â‘¡ Peran BOD â€” Executive Boardroom (4 menit)**
- Login sebagai **BOD**.
- Tunjukkan **kartu fitur** (VMAI, Perspektif BSC, Tren Strategis, Suksesi) â€” klik satu kartu untuk membuka panel detail.
- Buka **Analisis AI (Gemini)** â†’ tunjukkan insight otomatis (atau fallback ramah jika tanpa API key).
- Tekankan: **VMAI** + benchmark industri + faktor GCG.

**â‘¢ Peran HR â€” HR Command Center (4 menit)**
- Login sebagai **HR_MANAGER**.
- Tunjukkan kartu: **MPP & Rekrutmen, Lifecycle Pipeline, Learning & Certification, Cost & Risk**.
- Demo **lifecycle pipeline** (Pre/During/Post) dan **kalibrasi kurva Gaussian**.
- Tunjukkan **offboarding & clearance** + kalkulator pesangon PP 35/2021.

**â‘£ Peran Manager â€” Evaluation Cockpit (3 menit)**
- Login sebagai **PEOPLE_MANAGER**.
- Tunjukkan **Roster Tim**, **Approval KPI**, **Evaluasi GPA**, dan tombol **Approve Semua Nilai Tim**.
- Tekankan alur **approval berjenjang** + audit.

**â‘¤ Peran Karyawan â€” Employee Growth Portal (3 menit)**
- Login sebagai **EMPLOYEE**.
- Tunjukkan **Aksi Cepat** (kartu): Timesheet, Slip Gaji PIN, Peta Karir & Moodle, Profil Saya, dll.
- Buka **Scorecard GPA** (formula 50/20/15/15), **Sasaran Kerja & OKR**, dan **Kursus/Sertifikat**.

**â‘¥ Talent & Governance (4 menit)**
- Login sebagai **ASSESSOR** â†’ **9-Box Talent Matrix** + moderasi & simulasi suksesi.
- Login sebagai **AUDITOR** â†’ **Immutable Audit Trail** + prinsip **TARIF** (Transparansi, Akuntabilitas, Responsibilitas, Independensi, Fairness).

**â‘¦ Public Careers & AI Chat (3 menit)**
- Buka `/careers` (tanpa login) â†’ kirim lamaran kandidat, cek status, verifikasi sertifikat publik.
- Buka tombol **"Tanya AI"** di header â†’ ajukan pertanyaan data SDM.

**â‘§ Penutup (2 menit)**
- Rangkum: **keselarasan strategi (VMAI) + transparansi (GPA) + kepatuhan (audit immutable)**.
- Ajukan langkah berikut (pilot, data, timeline).

### Tips Presentasi
- Selalu **klik kartu** untuk menunjukkan pola interaksi (kartu â†’ panel), bukan menggulir panjang.
- Jangan tampilkan error/console. Kalau ada fitur opsional (AI tanpa key), jelaskan sebagai "mode fallback desain".
- Siapkan **rencana B** (screenshot/PDF) jika jaringan/server bermasalah.

---

## 8. Antisipasi Pertanyaan Client (Q&A)

| Pertanyaan | Jawaban Singkat |
|------------|-----------------|
| "Apakah penilaiannya objektif?" | Ya â€” **GPA** dengan bobot eksplisit 50/20/15/15 + 360Â° multi-rater + audit trail. |
| "Bagaimana membuktikan selaras strategi?" | **VMAI** menagregasi kontribusi tiap KPI ke pilar visi-misi, dengan ambang status resmi. |
| "Apakah compliant regulasi?" | Mengacu **PP 35/2021** (pesangon/PKWT) + **ISO 30414:2019** + prinsip **GCG (TARIF)**. |
| "Bisa diaudit?" | **Audit log immutable** (anti-tamper) + RBAC auditor read-only. |
| "Bisa skala besar?" | Driver **PostgreSQL server** (Neon) â€” lepas dari batas PGlite; hosting serverless. |
| "AI-nya pakai apa?" | **Google Gemini**, dipanggil server-side (kunci aman); **opsional** â€” tanpa kunci tetap berfungsi dengan pesan ramah. |
| "Apakah bisa dikustomisasi?" | Ya â€” bobot KPI, pilar strategis, kamus kompetensi, dan threshold dapat dikonfigurasi. |
| "Bagaimana keamanan data?" | JWT + RBAC + scope + enkripsi; auditor read-only terpisah. |
| "Integrasi ke sistem HR lama?" | API REST terstruktur (RFC 7807 error) â€” siap diintegrasikan (SSO/payroll). |

---

## 9. Acuan Resmi / Referensi

Aplikasi dibangun mengacu pada standar tata kelola & pengukuran SDM internasional/nasional berikut:

**A. Kerangka Kinerja & Manajemen**
1. **Balanced Scorecard (Kaplan & Norton)** â€” 4 perspektif: Finansial, Pelanggan, Proses Bisnis Internal, Pembelajaran & Pertumbuhan.
2. **OKR (Objectives & Key Results)** â€” cascading sasaran dari korporasi ke individu.
3. **KPKU / Malcolm Baldrige Criteria** â€” standardisasi pengukuran efektivitas kepemimpinan & manajemen tenaga kerja.

**B. Standar SDM Internasional**
4. **ISO 30414:2019** â€” *Human Resource Management â€” Guidelines for Human Capital Reporting* (metrik produktivitas, turnover, biaya, suksesi, kepatuhan).
5. **9-Box Talent Matrix (McKinsey / General Electric)** â€” segmentasi Kinerja (*Performance*) Ã— Potensi (*Potential*).

**C. Tata Kelola & Regulasi Nasional**
6. **Prinsip GCG (TARIF)** â€” Transparansi, Akuntabilitas, Responsibilitas, Independensi, Fairness (pedoman **KNKG**).
7. **UU Ketenagakerjaan No. 13/2003** & **UU Cipta Kerja No. 6/2023**.
8. **PP No. 35/2021** â€” PKWT, Alih Daya, Waktu Kerja, dan **Pemutusan Hubungan Kerja (pesangon)**.
9. **Regulasi DPLK / BPJS Ketenagakerjaan** â€” hak pensiun & jaminan sosial.

**D. Standar Teknis/Interoperabilitas**
10. **REST API + RFC 7807** (*Problem Details for HTTP APIs*) â€” format error standar.
11. **ISO 9001:2015** â€” acuan manajemen mutu proses.

**Rujukan internal proyek:**
- `PRD_Sistem_Penilaian_Karyawan (PT).md` â€” Product Requirements Document lengkap.
- `docs/decisions/` â€” Architecture Decision Records (ADR 003â€“013) â€” jejak keputusan teknis.

---

## 10. Lampiran: Akun Demo & Endpoint

### Akun Demo (password: `enterprise2026`)
| Peran | Email | Dashboard |
|-------|-------|-----------|
| BOD | hendra.gunawan@eperformiq.co.id | `/dashboard/executive` |
| HR_MANAGER | siti.nurhaliza@eperformiq.co.id | `/dashboard/hr-command` |
| PEOPLE_MANAGER | danu.tech@eperformiq.co.id | `/dashboard/manager-cockpit` |
| EMPLOYEE | budi.pratama@eperformiq.co.id | `/dashboard/employee-portal` |
| AUDITOR | bambang.audit@eperformiq.co.id | `/dashboard/audit-governance` |
| ASSESSOR | aris.assessor@eperformiq.co.id | `/dashboard/ninebox-matrix` |
| SUPER_ADMIN | admin@eperformiq.co.id | semua |

### Endpoint API Utama (contoh)
| Domain | Base Path |
|--------|-----------|
| Auth | `/api/v1/auth/*` |
| AI (Gemini) | `/api/v1/ai/{status,analyze,chat}` |
| Analytics | `/api/v1/analytics/*` |
| Performance | `/api/v1/performance/*` |
| Pre-Employment | `/api/v1/pre-employment/*` |
| Offboarding | `/api/v1/offboarding/*` |
| Learning (LMS) | `/api/v1/learning/*` |
| Recruitment | `/api/v1/recruitment/*` |
| Careers (publik) | `/api/v1/careers/*` |
| Certificates (publik) | `/api/v1/certificates/verify/:code` |
| Governance | `/api/v1/governance/*` |
| Finance | `/api/v1/finance/*` |
| Profile | `/api/v1/profile/*` |

### Halaman Publik (tanpa login)
- `/careers` â€” portal karir & kirim lamaran.
- `/careers/status` â€” cek status lamaran.
- `/certificates/verify/:code` â€” verifikasi sertifikat.

---

*Dokumen ini disusun untuk keperluan presentasi client. Untuk detail teknis penuh, lihat PRD dan ADR pada repo.*
