# Rencana: Penilaian Kinerja Fase "Saat Kerja" (DURING Employment)

**Tanggal:** 2026-10-10
**Penulis:** HR/Tech Lead (planning mode)
**Rujukan PRD:** §3.2 (Fase 2), §5.2 (Modul 2), §6.2 (GCG), lampiran endpoint.
**Tujuan:** Menutup gap agar seluruh komponen penilaian kinerja fase DURING **lengkap, terukur, dan tertaut** ke Composite GPA (50/20/15/15) sesuai PRD.
**Prinsip:** tiap item = (migrasi bila perlu) + service/repo + route/UI + TES hijau + `npm run build` OK. **Tidak ada commit/push** sampai disetujui.

---

## 0.0 KEPUTUSAN FINAL (disetujui pemilik produk, 2026-10-10)

| # | Pertanyaan | Keputusan | Implikasi |
|:--|:--|:--|:--|
| D1 | Sumber data SOP (G1) | **Manual HR/manager** (form). Import tiket/SLA ditunda | Tahap A pakai form; adapter impor opsional nanti |
| D2 | Minimum reviewer 360° (G2) | **≥ 3 orang** | Di bawah 3 → `sufficient=false`, agregat tak dipakai |
| D3 | Kehadiran (G5) | **Mengurangi nilai kinerja** (bukan sekadar laporan) | Perlu rumus disiplin yang **tak dobel-hitung** dengan SOP |
| D4 | Cakupan UI | **Sekalian layar** HR (`hr-command`) + manager (`manager-cockpit`) | Tambah panel, bukan API saja |
| D5 | Cara isi nilai GPA | **Manual + tombol "Tarik dari data"** | Nilai tidak auto-overwrite; HR/manager konfirmasi (jejak audit) |
| D6 | Bahasa UI karyawan | **"Anda"**, jargon di ⓘ, "GPA"→"Nilai Kinerja", cakup manager/hr-command, ada "Panduan Singkat" | Lihat §9 (paket bahasa awam) |

> Catatan keputusan D3 (FINAL): kehadiran **mengurangi** skor SOP (bukan menambah blok komposit baru). Blok "Kepatuhan Prosedur" (20%) memuat **faktor pengurang kehadiran** → bobot komposit tetap **50/20/15/15** sesuai PRD. **Tidak ada blok 15+5 terpisah.**

---

## 0. Ringkasan Eksekutif — Apa yang SUDAH vs HARUS Dibuat

Sistem sudah punya **tulang punggung** fase DURING. Yang kurang adalah **sumber data** untuk 2 dari 4 komponen GPA dan sub-matriks operasional.

### Sudah jalan (tidak perlu dibuat ulang)

| Kode | Komponen | Bukti di kode | Status |
|:--|:--|:--|:--|
| DUR-01 | Cascaded Individual KPI (bobot 50%) | `kpiService.ts` (submit/update/approve/weight/remove/seed), `cascading-tree`, `individual-kpis` route, `kpi-evidence` | ✅ Kuat |
| DUR-03 | Competency Mastery (bobot 15%) | `competency_frameworks`/`competencies`/`competency_scores`/`competency_evidence` (migrasi 0009), `competencyService`, `deriveCompetencyScoreForEmployee` (level 1–5, skill gap, training hours) | ✅ Kuat |
| — | Composite GPA engine 50/20/15/15 | `appraisalService.calculateAndSaveGPA`, `calculate-gpa` route, `calibrate`, guard immutable (GCG §6.2) | ✅ Kuat |
| — | 9-Box matrix | `nine-box-summary`, `calibrate`, engine quadrant | ✅ Kuat |
| — | Kehadiran & disiplin | `attendance_logs` (migrasi 0014), clock in/out geotag, `timesheets` + approver, `computeBradfordFactor` | ✅ Kuat (belum masuk GPA) |
| — | Training hours | `training-hours-engine`, `training-summary` route | ✅ (belum efektivitas L2/L3) |

### Gap — HARUS dibuat (5 item inti)

| # | Gap | Kode PRD | Dampak bila tidak dibuat |
|:--|:--|:--|:--|
| G1 | **Capture SOP & SLA compliance harian** (error rate, temuan non-compliance, ketepatan SLA) | DUR-02 (20%) | Komponen `sopScore` GPA tidak punya sumber riil; selalu diisi manual → VMAI tidak valid |
| G2 | **Agregasi 360° & derivation ke `coreValuesScore`** (saat ini hanya POST simpan, tak ada GET/rollup) | DUR-04 (15%) | `coreValuesScore` GPA tidak berasal dari data peer review |
| G3 | **Continuous Improvement / Kaizen registry** (min. 1 usulan/semester) | §3.2 sub-matriks | Tidak ada bukti kontribusi inovasi |
| G4 | **Training effectiveness (Kirkpatrick L2/L3)** — pre/post test delta | §3.2 sub-matriks | Jam pelatihan dihitung, dampak belajar tidak |
| G5 | **Attendance & disiplin masuk komponen penilaian** (Bradford < 45, keterlambatan < 0.5%) | §3.2 sub-matriks | Data ada tapi tidak menurunkan skor |

> Prioritas: **G1 dan G2 wajib** (langsung mengisi 2 dari 4 komponen GPA). **G3–G5 disarankan** (memperkuat sub-matriks & audit GCG).

---

## 1. Tahap A — SOP & SLA Compliance Engine (G1, DUR-02, bobot 20%) — **WAJIB**

**Gap:** tabel `sop_compliance_logs` belum mengisi metrik komponen SOP secara terstruktur; hanya dibaca untuk faktor GCG di `analyticsService`. Tak ada alur input/verifikasi harian.

**Desain:**
- Model data: per karyawan per periode — `error_count`, `fatal_error_count`, `sla_tasks_total`, `sla_tasks_on_time`, `audit_findings_count`. Skor `sopScore = f(error rate, SLA %, fatal errors)`.
- Rumus skor (0–100):
  - `slaRate = onTime/total` (target ≥ 0.98)
  - `errorPenalty = min(30, error_rate*100)`, `fatalPenalty = min(50, fatal*10)`
  - `sopScore = clamp(100*(0.6*slaRate + 0.4*(1-error_rate)) - fatalPenalty, 0, 100)`
- Sumber input (**keputusan D1**): **(a) manual HR/manager lewat form** — fokus fase ini. **(b) import tiket/SLA opsional DITUNDA**; tambahkan adapter `importSopMetrics(json)` di iterasi berikutnya bila sistem ops siap.
- Gate GCG: `fatal_error_count > 0` → tandai flag audit trail (bukan otomatis blok GPA).

**Perubahan file:**
1. Migrasi `0031_sop_compliance_metrics.sql` — perluas `sop_compliance_logs` (atau tabel baru `sop_period_metrics`) dengan kolom metrik di atas (aditif, idempoten `ADD COLUMN IF NOT EXISTS`).
2. `src/lib/services/sopComplianceService.ts` (baru): `upsertSopMetrics`, `getSopMetrics(employee, period)`, `computeSopScore`.
3. `src/lib/engines/sop-scoring-engine.ts` (baru): fungsi murni `computeSopScore(metrics)` (mudah dites).
4. `src/app/api/v1/performance/sop-compliance/route.ts` (baru): `GET` (list/scope), `POST`/`PUT` (upsert, RBAC `appraisal:calculate` atau manager scope).
5. UI: panel input SOP di `hr-command` / `manager-cockpit` (sekunder).
6. Wire: `calculateAndSaveGPA` — bila `sopScore` tidak dikirim, tarik dari `getSopMetrics` (opsional, jaga backward-compat: tetap utamakan input eksplisit).

**Tes:** `tests/api/sop-compliance.test.ts` (baru) + `tests/unit/sop-scoring-engine.test.ts`
- upsert metrik → hitung skor sesuai rumus (0 fatal, SLA 98% → ≥ target).
- fatal error menurunkan skor.
- RBAC: employee biasa tak bisa upsert; scope manager.
- integrasi: GPA memakai sopScore dari metrik.

---

## 2. Tahap B — 360° Feedback Rollup & Core Values Score (G2, DUR-04, bobot 15%) — **WAJIB**

**Gap:** hanya ada `POST /performance/360-reviews` (simpan). Tidak ada `GET` (daftar), tidak ada agregasi `coreValuesScore` dari `peer_reviews_360.overall_rating`.

**Desain:**
- Agregasi: rata-rata `overall_rating` (skala 5) dari semua reviewer (atasan/rekan/bawahan) untuk periode → konversi ke 0–100 (`avg/5*100`), target ≥ 4.2/5 (PRD).
- Anonimitas: GET hanya mengembalikan **agregat + jumlah reviewer per kelompok**, bukan identitas (GCG §6.2, AES-256-GCM sudah di PRD; minimal jangan bocorkan reviewer).
- Gate: minimal N reviewer (mis. ≥ 3) agar agregat sah; di bawah itu → tandai "insufficient".

**Perubahan file:**
1. `src/lib/services/coreValuesService.ts` (baru): `submit360Review` (pindahkan logika dari route), `list360Reviews(employee, periode)`, `aggregate360Score(employee, periode)` → `{avg, count, byGroup, sufficient}`.
2. `src/lib/engines/360-aggregation-engine.ts` (baru): fungsi murni `aggregateReviews(rows)`.
3. `src/app/api/v1/performance/360-reviews/route.ts`: tambah `GET` (agregat + daftar anonim, scope).
4. Wire: `calculateAndSaveGPA` — bila `coreValuesScore` kosong, tarik `aggregate360Score`.

**Tes:** `tests/api/360-reviews.test.ts` (baru) + `tests/unit/360-aggregation-engine.test.ts`
- POST beberapa review → GET agregat benar (avg, count, byGroup).
- anonimitas: response tak memuat identitas reviewer.
- threshold reviewer: < 3 → `sufficient=false`.
- integrasi GPA memakai agregat.

---

## 3. Tahap C — Continuous Improvement / Kaizen Registry (G3) — Disarankan

**Gap:** `achievement_type` enum sudah punya `KAIZEN_SAVING` (migrasi 0001) tapi tak ada service/route usulan ide.

**Desain:**
- Tabel `improvement_ideas` (atau pakai `achievement` existing): `employee_id`, `period_id`, `title`, `description`, `estimated_saving`, `status` (`SUBMITTED|APPROVED|REJECTED|IMPLEMENTED`).
- Target PRD: min. 1 usulan/semester. Indikator sub-matriks (bukan komponen GPA), masuk laporan DURING.

**Perubahan:** migrasi `0032_improvement_ideas.sql`; `improvementService.ts`; route `POST/GET /api/v1/performance/improvement-ideas`; UI usulan ide.

**Tes:** `tests/api/improvement-ideas.test.ts` — submit, approve, hitung "≥1/semester".

---

## 4. Tahap D — Training Effectiveness (Kirkpatrick L2/L3) (G4) — Disarankan

**Gap:** hanya jam pelatihan (`training-hours-engine`); tak ada pre/post test delta.

**Desain:**
- Modul LMS sudah punya `quiz`. Tambah: simpan `pre_test_score` & `post_test_score` per enrollment; hitung delta `%`; target delta ≥ +25% (PRD §3.2).
- Indikator masuk ke skor kompetensi (DUR-03) atau laporan training-summary.

**Perubahan:** migrasi add kolom skor ke `moodle_course_enrollments`/tabel quiz attempt; `trainingEffectivenessService.ts`; wire ke `training-summary` + opsional `deriveCompetencyScore`.

**Tes:** `tests/unit/training-effectiveness.test.ts` — delta dihitung; target tercapai/tidak.

---

## 5. Tahap E — Attendance & Discipline masuk penilaian (G5) — **WAJIB (keputusan D3)**

**Gap:** `computeBradfordFactor` ada, tapi tidak ada bobot/skoring ke GPA.

**Desain (keputusan D3 = kehadiran MENGURANGI nilai, TANPA blok komposit baru):**
- **Pendekatan FINAL:** kehadiran jadi **faktor pengurang `sopScore`** (blok "Kepatuhan Prosedur" 20%), sehingga bobot komposit tetap 50/20/15/15.**Tidak ada blok SOP 15% + Kehadiran 5% terpisah.**
  - `disciplineFactor = clamp(1 - penalty, 0.6, 1)` di mana `penalty = min(0.15, lateRate*10) + min(0.15, bradfordExcess)` dengan `bradfordExcess = max(0, (bradford-45)/45)`, `lateRate = telat/totalHariKerja`.
  - `sopScoreFinal = round(sopScoreBase * disciplineFactor)`.
  - Karyawan bersih (telat < 0.5%, Bradford < 45) → `disciplineFactor = 1` (tidak mengurangi).
- Transparan: scorecard menampilkan `sopScoreBase`, `disciplineFactor`, dan `sopScoreFinal` + alasan (mis. "3 hari telat, Bradford 52").

**Perubahan file:**
1. `src/lib/engines/discipline-engine.ts` (baru): `computeDisciplineFactor({ lateCount, workDays, bradford })` — fungsi murni.
2. `src/lib/services/attendanceService.ts` → `deriveDisciplineIndicator(employee, period)` mengembalikan `{ lateRate, bradford, factor, notes }`.
3. `sopComplianceService.computeSopScore` menerima `disciplineFactor` opsional (default 1) → `sopScoreFinal`.
4. `my-scorecard` + panel DURING menampilkan breakdown disiplin.
5. UI: banner peringatan di `hr-command`/`manager-cockpit` bila ada karyawan `lateRate ≥ 0.5%` atau `bradford ≥ 45`.

**Tes:** `tests/unit/discipline-engine.test.ts` + `tests/api/discipline-indicator.test.ts`
- bersih → factor 1.0 (nilai tak turun).
- telat 1% + Bradford 60 → factor < 1, sopScoreFinal turun, alasan tampil.
- batas clamp: penalty ekstrem → factor tidak < 0.6.

---

## 6. Wiring ke GPA & Scorecard (lintas tahap) + tombol "Tarik dari data" (keputusan D5)

**Prinsip D5: nilai TIDAK auto-overwrite.** Derivation selalu lewat aksi manusia.

- `calculateAndSaveGPA` tetap menerima 4 skor **eksplisit** (backward-compat).
- Tambah endpoint **preview** (tanpa simpan): `GET /api/v1/performance/gpa-preview?employee_id&period_id` → mengembalikan `sopScore` (dari metrik SOP + disciplineFactor), `coreValuesScore` (dari agregat 360), beserta **sumber** (`manual` | `derived` | `missing`) per komponen. **Tidak menulis apa pun.**
- UI: tombol **"Tarik dari data"** di form penilaian (`hr-command`/`manager-cockpit`) memanggil preview, mengisi field, lalu HR/manager **menekan Simpan** (menulis via `calculateAndSaveGPA`). Semua penulisan tercatat (jejak audit GCG).
- `my-scorecard` route: sertakan breakdown 4 komponen + sumber (manual vs derived) + indikator sub-matriks (disiplin, kaizen count, training delta).
- **Employee Growth Portal** (PRD §5/§6.1): tampilkan target aktif, Nilai Kinerja real-time, riwayat pelatihan.

**Tes:** `tests/api/gpa-preview.test.ts`
- preview mengembalikan derived score benar & `source='derived'`; **tidak** menulis baris appraisal.
- komponen tanpa data → `source='missing'`, field kosong (tidak menebak).
- simpan setelah tarik → `source='manual'` utk komponen yang diisi.

---

## 7. Validasi Akhir

- `npm run db:migrate` (bila ada migrasi baru) → `npm run db:reset` sebelum suite route.
- Jalankan suite baru + regresi GPA/KPI/9-Box + `npm run build` (harap exit 0).
- Semua perubahan **UNCOMMITTED**; tidak push.

---

## 8. Urutan Implementasi (keputusan final)

| Urutan | Tahap | Prioritas | Nilai |
|:--|:--|:--|:--|
| 1 | A — SOP & SLA engine (**manual**, D1) | **Wajib** | Mengisi komponen GPA 20% dari data riil |
| 2 | B — 360 rollup (**min ≥3**, D2) | **Wajib** | Mengisi komponen GPA 15% dari data riil |
| 3 | E — Kepatuhan & Kehadiran (**kurangi nilai**, D3) | **Wajib** | Sub-matriks kehadiran → memengaruhi skor |
| 4 | D5 wiring — GPA preview + tombol "Tarik dari data" + panel **hr-command & manager-cockpit** (D4) | **Wajib** | Kontrol manusia + jejak audit |
| 5 | C — Kaizen registry | Disarankan | Sub-matriks inovasi |
| 6 | D — Training effectiveness | Disarankan | Sub-matriks pembelajaran (Kirkpatrick) |
| 7 | §9 — Paket bahasa awam UI (D6) | **Wajib** | Karyawan baru paham tanpa training |

> Semua keputusan sudah diambil (D1–D6). **Tidak ada pertanyaan terbuka.** Rencana siap disetujui.

---

## 9. Paket Bahasa Awam UI (keputusan D6) — **WAJIB**

**Prinsip:** hanya **label, urutan, dan teks bantuan** yang berubah. **Logika, API, rumus, state `kpiForm`, dan skema DB TIDAK disentuh.** Jargon tetap tampil lewat ikon ⓘ agar HR/auditor GCG tetap aman.

### 9.1 Glosarium — `src/lib/employee/plainLanguage.ts` (baru, satu file)

| Teknis | Awam | Tooltip ⓘ "apa ini?" |
|:--|:--|:--|
| GPA 50/20/15/15 | **Nilai Kinerja** | "Gabungan target, prosedur, kemampuan, sikap. Skala 1–4." |
| Cascaded KPI (DUR-01) | **Target Kerja** | "Capaian utama Anda. Bobot 50%." |
| SOP Compliance (DUR-02) | **Kepatuhan Prosedur** | "Ketaatan aturan & tenggat waktu. 20%." |
| Competency (DUR-03) | **Kemampuan & Pelatihan** | "Skill + jam pelatihan. 15%." |
| Core Values / 360 (DUR-04) | **Sikap & Penilaian Rekan** | "Perilaku, dinilai atasan/rekan. 15%." |
| Bradford Factor | **Pola Kehadiran** | "Seberapa sering tidak hadir." |
| Kirkpatrick L2/L3 | **Efek Pelatihan** | "Peningkatan nilai pra vs pasca pelatihan." |

Plus komponen **`TermTooltip`** (ikon ⓘ aksesibel: `aria-label`, fokus keyboard, kontras AA).

### 9.2 Rombak modal input KPI (`employee-portal/page.tsx`)

- Judul modal: "Ajukan Sasaran KPI" → **"Tambah Target Kerja Baru"**.
- Subjudul: **"Isi 4 hal, ±2 menit. Bisa diubah nanti."**
- "Judul Sasaran KPI (SMART Target)" → **"Target kerja Anda"** + contoh konkret ("mis. Turunkan waktu proses klaim ke 2 hari").
- "Pilar Strategis Balanced Scorecard (BSC)" → **"Tersambung ke tujuan perusahaan mana?"** + opsi bergaya awam ("Membuat pelanggan puas", dst.). Nilai UUID pilar tetap sama.
- "Bobot Sasaran (%)" → **"Seberapa penting? (bobot %)"** + saran "umumnya 20–30%".
- Banner "Total Bobot... 100%" → pilihan sederhana (kalimat awam, tombol quick-action tetap).
- **Section "Panduan Singkat"** di atas form: 3–4 poin "cara isi cepat" + tautan ke glosarium.
- Istilah asli (BSC, dll.) tetap di tooltip ⓘ.

### 9.3 Ganti label "GPA" → "Nilai Kinerja" (D6)

Ganti **total** di UI karyawan: hero "Cumulative Weighted GPA", "Composite Performance Scorecard", dsb. → pakai istilah awam. Terapkan ke `employee-portal`, `manager-cockpit`, `hr-command`.

### 9.4 Perubahan file

1. `src/lib/employee/plainLanguage.ts` (baru) — peta istilah + tooltip.
2. `src/components/ui/TermTooltip.tsx` (baru) — ikon ⓘ aksesibel.
3. `src/app/dashboard/employee-portal/page.tsx` — label modal + section Panduan Singkat + label scorecard.
4. `src/app/dashboard/manager-cockpit/page.tsx` + `hr-command/page.tsx` — label awam.

**Tanpa migrasi DB. Tanpa perubahan API/rumus/state.**

**Tes:** `tests/unit/plain-language.test.ts` (peta istilah lengkap, tak ada istilah teknis tersisa di label) + `get_errors` bersih + `npm run build` exit 0.
