# Spec — Modul Rekrutmen End-to-End, Onboarding LMS & Payroll (E-PerformIQ)

> **Status:** DRAFT untuk direview · **Tanggal:** 2026-10-02
> **Cakupan:** A (Rekrutmen/Kandidat) + B (LMS Onboarding + e-Sertifikat) + C (Absensi/Timesheet + Payroll)
> **Tujuan:** mengubah E-PerformIQ menjadi aplikasi rekrutmen→onboarding→kerja yang siap produksi.
> **Prinsip:** bertahap (workstream terpisah), TDD, driver-agnostic (PGlite/Postgres), RBAC + audit trail.

---

## 0. Ringkasan Alur End-to-End

```
[Publik] /careers (login kandidat khusus, BUKAN login karyawan)
   → lihat posisi + kualifikasi + kuota + status lowongan
   → pilih posisi → form lamaran + upload resume → ATS parsing otomatis → masuk DB
   → timeline progress (Lamaran → Tes → Interview → Review HR → Keputusan)
   → tes: Psikometri 30% + Teknis 40% + Wawancara 30% (jadwal dari HR)
   → [HR] tinjau + analisis AI → keputusan → timeline kandidat ter-update otomatis
   → (jika DITERIMA) onboarding Moodle per posisi → e-sertifikat
   → absensi + timesheet harian (foto) & payroll (gaji/bonus/THR/BPJS/PPh21)
   → HR/Manager monitor; pasca-kerja (cuti/LCI/exit)
```

---

## 1. Kondisi Saat Ini (fondasi yang SUDAH ada)

| Area | Aset existing | Rencana |
|------|---------------|---------|
| Auth | JWT + RBAC 7 peran | tambah peran `CANDIDATE` + login terpisah |
| Publik | `/careers` (lamar, cek status, verifikasi sertifikat) | perluas → portal ber-login |
| Kandidat | `candidates`, `job_applications` | perluas (ATS, skor, timeline) |
| Lowongan | `job_postings` (OPEN/FILLED), `manpower_plans` | perluas (kuota, kualifikasi) |
| Interview | `interview_slots` | perluas (jadwal online + link) |
| LMS | `moodle_courses`, `course_modules`, `course_completions`, `certificates`, competency, `learning_plans` | dipakai untuk onboarding per-posisi |
| Absensi | `attendance_records` | perluas (foto, timesheet detail) |
| Payroll | `payslip` (PIN) | perluas (komponen lengkap) |
| AI | `aiService` (Gemini/Groq/OpenRouter) | dipakai (ATS, ringkasan, rekomendasi) |
| Audit | `audit_logs` immutable | dipakai |

→ Membangun di atas fondasi, bukan dari nol.

---

## 2. Workstream A — Portal Rekrutmen & Kandidat

- **A1. Dua login terpisah:** `/login` (karyawan, ada) & `/careers/login` + `/careers/register` (kandidat). Peran `CANDIDATE`, cookie sesi terpisah (`eperformiq_candidate_token`). Link portal dibagikan HR: `/careers`.
- **A2. Daftar lowongan:** tampilkan judul, kualifikasi, **kuota** (MPP − terisi), **status** (Tersedia/Terisi/Ditutup) real-time. Filter posisi/divisi.
- **A3. Form lamaran + upload resume + ATS otomatis:** ekstraksi PDF/DOCX → parsing (nama, kontak, skill, pendidikan, pengalaman) → auto-isi DB → **skor ATS** (match vs `required_skills`) + gap. AI sebagai fallback ekstraksi.
- **A4. Timeline kandidat:** Lamaran → ATS → Psikometri → Teknis → Wawancara → Review HR → Keputusan; status per tahap; **update otomatis**.
- **A5. Mesin tes:** `Skor = 30% Psikometri + 40% Teknis + 30% Wawancara`. Psikometri (IPIP), Teknis (bank soal per jabatan + auto-grade), Wawancara (jadwal online dari HR + skor rubrik).
- **A6. Review HR + AI + keputusan:** panel HR dengan skor & gap; AI beri ringkasan + rekomendasi; HR tetapkan `ACCEPTED/REJECTED/TALENT_POOL`; timeline & hasil tampil di portal kandidat. **AI advisory, keputusan manusia** (UU PDP/etika).
- **A7. Kuota otomatis:** kandidat ACCEPTED mengisi kuota; penuh → `job_postings.status = FILLED`.

---

## 3. Workstream B — Onboarding LMS + e-Sertifikat

- **B1. Kurikulum per posisi:** tabel `position_courses` (posisi→kursus). Materi = link OSS (metadata) atau materi manual HR. HR bisa tambah manual atau pilih template otomatis.
- **B2. Onboarding:** kandidat ACCEPTED → learning plan otomatis (kursus wajib posisi) → selesaikan modul → `course_completions`.
- **B3. e-Sertifikat:** semua kursus wajib selesai → terbitkan sertifikat (verifikasi publik `/certificates/verify/:code`), tampil di portal karyawan.

---

## 4. Workstream C — Absensi/Timesheet + Payroll

- **C1. Absensi & Timesheet:** perluas `attendance_records` (check-in/out, status, **foto bukti**, lokasi) + timesheet harian (kegiatan, durasi, foto). Approval atasan.
- **C2. Payroll:** gaji pokok, tunjangan, **lembur otomatis** (UU Ketenagakerjaan), bonus, **THR**, potongan **BPJS Kes & Naker**, **PPh 21**; pro-rata & harian. AI bantu ringkasan/anomali (formula tetap deterministik). HR input di sistem utama; slip di portal (PIN). Ekspor laporan (SIPP/pajak) fase lanjut.
- **C3. Pasca-kerja:** tunjangan cuti, riwayat kontribusi (LCI), exit clearance (fondasi sudah ada).

---

## 5. Sumber Terbuka (OSS) — Hasil Riset

> ⚠️ Cek lisensi per-item. Bukan nasihat hukum.

### 5.1 Materi LMS (kurikulum per posisi)
| Posisi | Sumber | Lisensi | Re-host? |
|--------|--------|---------|----------|
| Frontend | MDN Learning (`github.com/mdn/content`) | Prosa CC-BY-SA 2.5; kode CC0/MIT | ✅ |
| Backend/CS | OSSU (`github.com/ossu/computer-science`) | MIT (kurasi) | ⚠️ link |
| Cloud | MIT OCW, Microsoft Learn | CC BY-NC-SA / proprietary | ⚠️/❌ |
| Semua | free-programming-books (EbookFoundation) | CC-BY 4.0 | ✅ |
| PM/Agile | Scrum Guide | Bebas + atribusi | ✅ |
| Data | Kaggle Learn, fast.ai | link-only | ❌ |
| HR/Finance/PM | OpenLearn (OU), Saylor | CC BY-NC-SA | ⚠️ |

**Strategi:** ✅ re-host; ⚠️/❌ simpan **link + metadata**; kuis modul dibuat sendiri.

### 5.2 Bank Soal Teknis (auto-gradable)
| Bank | Lisensi | Re-host? | Skoring |
|------|---------|----------|---------|
| HumanEval (164 Python) | MIT | ✅ | test-driven |
| MBPP (~1000) | Apache-2.0 | ✅ | task + unit test |
| MMLU (57 subjek) | MIT | ✅ | MCQ |
| BIG-bench | Apache-2.0 | ✅ | campuran |
| Open Trivia DB | CC BY-SA 4.0 | ✅ | MCQ |
| Exercism | AGPL-3.0 | ⚠️ link | test-suite |
| LeetCode/HackerRank/CodeSignal | proprietary | ❌ link | — |

**Rekomendasi:** HumanEval + MBPP (koding) + MMLU (pengetahuan IT/bisnis).

### 5.3 Instrumen Psikometri
| Instrumen | Lisensi | Komersial? |
|-----------|---------|-----------|
| **IPIP** (`ipip.ori.org`) | **Public domain** | ✅ paling aman |
| Open-Source Psychometrics Project | CC (per-skala) | ⚠️ |
| HEXACO-PI-R / BFI | riset; perlu izin | ⚠️ |
| RIASEC Markers / O*NET Interest Profiler | public domain | ✅ |

### 5.4 IRT vs CTT
- **CTT:** skor = jumlah/Likert + Cronbach α — mudah, cocok rilis awal (N kecil).
- **IRT:** 1PL/Rasch → 2PL (butuh ≥200–500 respon/item); memberi error/kandidat + CAT.
- **Rute:** rilis CTT → simpan respon per-item → naik 1PL/Rasch bila data cukup. Library: R `mirt`, Python `py-irt`. Lewati 3PL.

---

## 6. Skema DB Baru (ringkas)

- `candidate_accounts` (login kandidat, terpisah dari `users`).
- `candidate_profiles`, `candidate_skills`, `candidate_educations`, `candidate_experiences`.
- `resume_parses` (raw text, parsed JSON, ats_score, provider).
- `application_timeline` (tahap, status, timestamp, catatan).
- `assessment_templates` (jenis, bobot) + `assessment_questions` (MCQ/CODING/LIKERT) + `assessment_attempts` + `assessment_responses`.
- `interview_schedules` (perluas `interview_slots`: link meeting, interviewer, skor).
- `position_courses` (posisi → kursus).
- `payroll_runs` + `payroll_items` + `payroll_components` (perluas payslip).
- Perluasan: `attendance_records`, `daily_timesheets` (foto bukti).

---

## 7. Keamanan & Kepatuhan
- RBAC: `CANDIDATE` hanya akses data miliknya; `HR_MANAGER` kelola rekrutmen; `AUDITOR` read-only.
- Session kandidat **terpisah** dari karyawan (anti-campur).
- Audit setiap aksi (lamaran, keputusan, akses data).
- **Kepatuhan:** UU PDP, etika rekrutmen (no auto-reject), AI advisory.
- Resume & data pribadi: dienkripsi at-rest (produksi), akses terbatas.

---

## 8. Definisi Selesai (per workstream)
- Kode + tes hijau (unit/integrasi), build sukses, migrasi idempoten.
- UI berfungsi (manual/browser check), RBAC & scope teruji.
- Update README + ADR bila ada keputusan arsitektur.

---

## 9. Non-Goals (fase ini)
- Pembayaran/disbursement bank H2H nyata (simulasi + ekspor dulu).
- Pelatihan model IRT penuh (mulai CTT).
- Integrasi HRIS eksternal (SAP/Oracle) — desain seam saja.
