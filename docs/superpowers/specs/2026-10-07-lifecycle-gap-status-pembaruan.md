# Audit Lifecycle PRE → DURING → POST — Status Terkini

> Dokumen ini adalah **pembaruan** dari audit gap integrasi lifecycle (7 Okt 2026).
> Seluruh 8 gap kritis telah **ditutup** melalui Tahap 1–8 dan divalidasi dengan tes.
> Rujukan rencana: `docs/superpowers/plans/2026-10-07-lifecycle-end-to-end-integration.md`.
> Status verifikasi: **full suite 651 lulus, 1 skip**, `npm run build` sukses (exit 0).
> Tahap lanjutan R1–R3 (batch GPA massal, template KPI per jabatan, notifikasi kaya) **selesai** — lihat §5.

---

## 1. Ringkasan Status per Fase

| Fase | Status | Yang sudah jalan | Yang belum tersambung |
|---|---|---|---|
| **Sebelum Kerja (PRE)** | 🟢 **Kuat** | Karier publik, ATS, IRT/psikometri, tes teknis AI, konversi kandidat → karyawan, onboarding 30-60-90, **evaluasi probation (UI + route)**, **auto-assign KPI + periode appraisal** | — |
| **Saat Kerja (DURING)** | 🟢 **Kuat** | Cascading KPI, GPA (KPI/SOP/Kompetensi/Values), 9-Box, 360, LMS, absensi, payroll, flight-risk | — |
| **Setelah Kerja (POST)** | 🟢 **Kuat** | Offboarding request + state machine, checklist serah terima, kalkulator pesangon, exit interview, legacy vault, **write-back status karyawan**, **pesangon → payroll final settlement**, **notifikasi lifecycle** | — |

---

## 2. Gap Integrasi Kritis — Status Penutupan

### ✅ #1 — Offboarding kini menonaktifkan karyawan
Saat request bertransisi ke `COMPLETED`: `UPDATE employees SET status='RESIGNED'|'RETIRED', last_working_day=<LWD>` lalu `users.is_active=false`.
Bukti: `src/lib/services/offboardingService.ts:198-215` (exitStatus `RESIGNED`/`RETIRED` sesuai alasan, mis. pensiun → `RETIRED`).

### ✅ #2 — Pesangon terhubung ke payroll
`buildFinalSettlementRun()` (`payrollService.ts:172-249`) membuat run payroll bertipe `FINAL_SETTLEMENT` dengan kolom `severance` + `dplk_topup` di `payroll_items`, sumber `severance_calculations`. Slip gaji final settlement kini akurat.

### ✅ #3 — Endpoint probation kini dipanggil UI
`PUT /api/v1/pre-employment/probation/[id]` sudah di-`fetch` dari `manager-cockpit/page.tsx:235` (daftar) dan `:267` (submit day-30/60/90 + `probation_passed`). Konversi `PERMANENT` dapat dioperasikan dari UI.

### ✅ #4 — Auto-assign KPI & periode appraisal saat karyawan masuk
`ensureStarterKpiBridge()` (`candidateConversionService.ts:49`) + `ensureActiveAppraisalPeriod()` + `seedStarterKpis()` dijalankan pada **kedua** cabang konversi (`:97` reuse, `:132` karyawan baru). Karyawan baru langsung punya KPI pembuka (bobot 30/25/25/20).

### ✅ #5 — Pelanggaran GCG menurunkan VMAI
`computeGcgComplianceFactor()` (`analyticsService.ts`) menghitung faktor dari `sop_compliance_logs` (bukan lagi hardcoded `1.0`); `getBenchmarkGap` mengisi `VMAI_TARGET.actual` dari scorecard nyata.

### ✅ #6 — Scope ASSESSOR diperketat
`ASSESSOR` dikeluarkan dari `ORG_WIDE_ROLES` (`scope.ts`) → scope `[]` eksplisit; `profile:write` dicabut (`rbac.ts`). Prinsip *least privilege* GCG terjaga.

### ✅ #7 — State machine offboarding
`INITIATED → HANDOVER → CLEARED → COMPLETED` diterapkan; gate clearance memblokir cetak slip/pesangon sebelum checklist `Completed` (PRD §8).

### ✅ #8 — Notifikasi lifecycle karyawan
Tabel `employee_notifications` (migrasi `0027`) + `notifyEmployeeLifecycle()` untuk event: `HIRED_ONBOARDING`, `PROBATION_PASSED`, `OFFBOARDING_INITIATED`, `SEVERANCE_PAID`.

---

## 3. Peta Integrasi Antar-Role — Status Terkini

| Transisi | Pemrakarsa | Penerima/Peninjau | Status |
|---|---|---|---|
| Kandidat → Karyawan | ASSESSOR / HR_MANAGER | EMPLOYEE | ✅ jalan |
| Onboarding 30-60-90 | PEOPLE_MANAGER | HR_MANAGER | ✅ API **dan** UI |
| Probation → PERMANENT | PEOPLE_MANAGER | HR_MANAGER | ✅ UI aktif |
| KPI → GPA → kalibrasi | EMPLOYEE → PEOPLE_MANAGER | HR/ASSESSOR/BOD | ✅ jalan |
| 9-Box / suksesi | HR_MANAGER | BOD | ✅ jalan |
| Offboarding | EMPLOYEE / HR | PEOPLE_MANAGER verifikasi | ✅ state machine + write-back |
| Pesangon / clearance | HR_MANAGER | AUDITOR | ✅ masuk payroll (FINAL_SETTLEMENT) |
| Audit trail (immutable) | semua | AUDITOR | ✅ read-only benar |
| Laporan eksekutif VMAI | agregasi | BOD | ✅ GCG factor nyata + VMAI_TARGET real |

**Peran yang sudah benar:** AUDITOR murni read-only di seluruh matriks. EMPLOYEE ter-scope ke dirinya sendiri. ASSESSOR kini ter-scope (tidak lagi org-wide).

---

## 4. Validasi

| Item | Hasil |
|---|---|
| Tahap 1 — Offboarding write-back + state machine | ✅ 7/7 |
| Tahap 2 — Final settlement payroll run | ✅ 3/3 |
| Tahap 3 — Clearance gate | ✅ 7/7 |
| Tahap 4 — Probation UI + route | ✅ 2/2 |
| Tahap 5 — Auto-assign KPI + periode aktif | ✅ 3/3 |
| Tahap 6 — Notifikasi lifecycle | ✅ 3/3 |
| Tahap 7 — GCG factor + VMAI target | ✅ 4/4 |
| Tahap 8 — Scope/RBAC (ASSESSOR) | ✅ 5/5 |
| Full suite | ✅ 111 file, 632 lulus, 1 skip |
| `npm run build` | ✅ sukses |

---

## 5. Rekomendasi Lanjutan (pasca-tutup gap) — ✅ SELESAI

Semua rekomendasi Tahap 1–3 pada audit awal **sudah tuntas** (item 1–8), dan tiga rekomendasi lanjutan kini juga **selesai** (Tahap R1–R3):

### ✅ R1 — Batch/queue async untuk GPA massal (PRD §6.1)
Antrean job GPA massal dengan tabel `gpa_batch_jobs` (migrasi `0028`).
- **Service:** `src/lib/services/gpaBatchService.ts` — `enqueueGpaBatch`, `listGpaBatchTargets`, `processGpaBatch`, `getGpaBatchJob`, `listGpaBatchJobs`.
- **API:** `POST /api/v1/appraisals/batch` (menaruh job, `202 Accepted`) + endpoint status/daftar job.
- **RBAC:** permission `appraisal:batch` (HR/PEOPLE_MANAGER).
- **Bukti tes:** `tests/integration/gpaBatch.test.ts` — ✅ **8/8**.

### ✅ R2 — Template KPI per jabatan (PRD §6.1)
Starter KPI tidak lagi generik: kini berasal dari template sesuai `employees.position_id`.
- **Migrasi:** `0029_position_kpi_templates.sql` — tabel `position_kpi_templates` + index, `UNIQUE(position_id, kpi_title)`.
- **Seed:** template untuk 7 jabatan (CEO, VP HC, Head Eng, Sr SWE, Chief Internal Auditor, HR Sys Admin, Lead Talent Assessor), tiap set berjumlah 100%.
- **Service:** `seedStarterKpis()` di `kpiService.ts` kini mengembalikan `{ seeded, kpis, source: 'template' | 'generic' | 'none' }` — pakai template jabatan bila ada, fallback generik (30/25/25/20).
- **Bukti tes:** `tests/integration/kpiTemplates.test.ts` — ✅ **6/6**; regresi `tests/integration/starterKpiOnboarding.test.ts` — ✅ **3/3**.

### ✅ R3 — Notifikasi in-app/email lebih kaya (PRD §6.1)
- **Migrasi:** `0030_employee_notification_rich.sql` — kolom `category`, `severity`, `action_url`, `email_status` + partial index unread.
- **Service:** `notificationService.ts` — 9 event lifecycle, meta kategori/severity/CTA per event, email HTML branded (accent bar, badge severity, tombol CTA, preheader, escaping XSS), `listEmployeeNotifications`, `unreadEmployeeNotificationCount`, `markEmployeeNotificationsRead`.
- **API:** `GET/POST /api/v1/notifications` (daftar + `unreadCount`, tandai sudah dibaca).
- **Bukti tes:** `tests/integration/richNotifications.test.ts` — ✅ **6/6**.

### Ringkasan Validasi Tahap R1–R3

| Item | Hasil |
|---|---|
| R1 — Batch/queue GPA massal | ✅ 8/8 |
| R2 — Template KPI per jabatan (+ regresi onboarding) | ✅ 6/6 + 3/3 |
| R3 — Notifikasi in-app/email kaya (+ regresi schema) | ✅ 6/6 + 4/4 |
| Full suite | ✅ 651 lulus, 1 skip |
| `npm run build` | ✅ sukses (exit 0) |

> Catatan: kemunculan `RuntimeError: Aborted()` pada stderr saat *page-data collection* bersifat **non-fatal** (PGlite WASM) — build tetap sukses (exit 0). Bila muncul kaskade `PageNotFoundError`, bersihkan `.next` lalu build ulang.
