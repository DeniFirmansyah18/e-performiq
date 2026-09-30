# Spec: E-PerformIQ — Demo → Production-Ready (Full Remediation)

**Tanggal:** 2026-09-30
**Status:** Menunggu review
**Terkait:** PRD `PRD_Sistem_Penilaian_Karyawan (PT).md` v1.0.0
**Keputusan owner:** Scope = full production-ready (temuan 1-7); angka hardcode diganti
perhitungan dari DB; database **dual-driver** — PGlite (in-process PostgreSQL 16 WASM)
tetap menjadi default zero-setup, dengan jalur upgrade mulus ke PostgreSQL server via
`DATABASE_URL` tanpa menulis ulang kode/skema/query. Wajib disertai test dual-mode.

---

## 1. Tujuan & Kriteria Sukses

Mengubah aplikasi dari "demo berfungsi sebagian" menjadi "aplikasi siap pakai" di mana:

1. **Semua test hijau** (`npm run test` dan `npm run build` lulus tanpa error).
2. **Seed berjalan end-to-end** pada DB bersih; aplikasi dapat di-boot ulang dari nol.
3. **Semua angka di dashboard berasal dari database** (tidak ada nilai hardcode yang
   menyesatkan keputusan eksekutif). Angka konfigurasi (benchmark industri, bobot standar)
   disimpan sebagai data seed, bukan literal di dalam kode render.
4. **Otorisasi konsisten**: gating role ditegakkan di server, bukan hanya di UI.
5. **Tidak ada file sisa** (`.bak`) maupun export `dummy-data` mati.

**Success metric:** dari kondisi sekarang (10 test suite gagal, seed error 42601) →
`npm run test` 0 fail, `npm run build` sukses, dan setiap metric card/chart di 6 dashboard
menampilkan nilai yang dapat ditelusuri ke query repository.

---

## 2. Kondisi Saat Ini (baseline terverifikasi)

- Backend 30/34 route DB-backed; auth JWT+bcrypt asli; scope+RBAC+audit-immutable asli.
- Engine murni sesuai PRD: GPA 50/20/15/15, severance PP 35/2021, VMAI.
- **Test MERAH** — 10 suite gagal; akar: `runSeed` throw
  `error 42601: INSERT has more expressions than target columns` pada
  `INSERT INTO performance_appraisals` (offset 14107).
- **Akar bug pasti (terverifikasi):** baris seed appraisals memiliki **16 kolom / 17 nilai**.
  Kolom: `id, period_id, employee_id, kpi_composite_score, sop_compliance_score,
  competency_score, core_values_score, total_percentage_score, composite_gpa,
  performance_rating, potential_score, nine_box_quadrant, is_calibrated, calibrated_by,
  calibrated_at, calibration_notes`. Nilai memiliki UUID ke-4 nyasar
  (`b0000000-...-000000000004`) sebelum angka pertama.
- 2 test lain gagal mandiri (Bradford `expected +0 to be 1`) — perlu diselidiki apakah
  sebab-akibat dari seed gagal atau bug terpisah di `buildRiskProfile`.

---

## 3. Ruang Lingkup (Workstreams)

### WS-0 — Perbaikan Blocker Seed & Test (WAJIB PERTAMA)
- Perbaiki baris `performance_appraisals` di `src/lib/db/seed/index.ts`:
  `employee_id` = `b0000000-0000-4000-8000-000000000004` (Budi), hapus UUID nyasar.
- Verifikasi `runSeed` lulus pada `createTestDb()` (in-memory) DAN `npm run db:reset`.
- Jalankan ulang suite; perbaiki sisa kegagalan (mis. Bradford flight-risk).
- **Gate:** seluruh suite hijau sebelum WS lain dianggap selesai.

### WS-1 — Hilangkan Hardcode: Analitik (DB-driven)
| Lokasi | Hardcode | Ganti dengan |
|---|---|---|
| `analyticsRepository.ts` | `92.4 as "achievedScore"` | agregasi `individual_kpis` (achieved vs target × bobot) per pilar |
| `vmai-engine.ts` / VMAI route | `totalEmployees: 1240`, `periodCode '2026-Q3'` | `COUNT(employees)`, `appraisal_periods` aktif |
| `analytics/benchmark-gap/route.ts` | benchmark industri inline | tabel konfigurasi baru `industry_benchmarks` (seeded) |
| `performance/cascading-tree` | vision/mission string | tabel `company_vision_mission` (seeded) atau kolom `companies` |

Prinsip: nilai yang **harus bisa diubah tanpa koding** (benchmark, visi-misi) → tabel +
seed. Nilai yang **seharusnya diturunkan** (skor agregat, jumlah karyawan) → query.

### WS-2 — Hilangkan Hardcode: UI Dashboard
Ganti metric card/chart/series/tabel hardcode di 6 halaman dengan data dari API/repository:
- `executive`: kartu BSC, tren VMAI (series), heatmap pilar, kartu suksesi/TARIF.
- `hr-command`: kartu lifecycle (96.4%, 3.52, 98.7%, 2.1%), `candidates[]` pipeline.
- `manager-cockpit`: `teamRoster` (dari scope subordinate), kartu metrik.
- `employee-portal`: scorecard GPA & komponen% (dari appraisal dirinya).
- `ninebox-matrix`: `QUADRANTS`, summary (1240/42/180/12), "Simulasi Talent Pool" (hapus
  setTimeout palsu → aksi nyata atau label jelas).
- `audit-governance`: `tarifPrinciples[]` boleh tetap statis (konten konseptual) — keputusan
  akan dicatat di ADR; metrik numerik dari API.
- `charts/RadarChartBSC.tsx`, `GaussianCurve.tsx`: terima props data, bukan data internal.
- Rute agregat baru yang dibutuhkan didaftarkan di §4.

### WS-3 — Chatbot Governance Fungsional (tanpa LLM eksternal)
Mengganti keyword if/else statis dengan engine berbasis data:
- Jalur 1 (deterministik): jawab pertanyaan kebijakan dari **tabel FAQ/kebijakan ter-seed**
  (`policy_knowledge_base`) dengan pencarian kata kunci+skor, dan **jawaban berbasis data
  nyata** (saldo cuti, status klaim, tanggal pesangon) via repository + scope user.
- Wajib **terautentikasi** dan **scope-aware** (hanya data milik user).
- Jalur LLM/RAG tetap **ditunda** (sesuai plan Remediasi M-11) — dicatat, bukan dikerjakan.
- Tulis test baru menggantikan `helpdeskChatbotService.test.ts` yang lemah.

### WS-4 — Otorisasi Server-side (gating role)
- `middleware.ts`: verifikasi JWT (`verifySession`) + redirect berbasis role, bukan sekadar
  cek keberadaan cookie.
- Tambah helper gating halaman (`requireRole`) di server component/layout dashboard per role.
- Client `AuthContext`: hapus default `activeRole='BOD'`/`isAuthenticated=true`; mulai dari
  state "loading" sampai `/auth/me` selesai.
- Pertahankan enforcement API yang sudah ada (sumber kebenaran utama tetap server API).

### WS-5 — Kebersihan Repo
- Hapus 22 file `.bak` (source, seed, migration, component, 4 test `.bak`).
- Hapus/relokasi `src/lib/dummy-data/index.ts`: `DUMMY_USERS` dipakai `login`+`Header`;
  ganti dengan sumber nyata (mis. endpoint daftar demo user khusus dev, atau konstanta
  eksplisit `DEMO_LOGIN_ACCOUNTS` yang jelas bukan "data bisnis"). 15 export mati dibuang.
- Hapus `scripts-*.mts` sisa investigasi (sudah dibersihkan).

### WS-6 — Kelengkapan Domain (PKWT)
- Tambah kolom `contract_end_date` ke `employees` via migrasi baru `0006_...sql`.
- Isi di seed untuk karyawan CONTRACT/PROBATION; modernisasi `coreHrService`
  `contractDaysRemaining` (hilangkan TODO).

### WS-7 — Verifikasi & Dokumentasi
- `npm run test` + `npm run build` hijau; smoke test 6 dashboard + 8 modal employee
  (fetch nyata, tidak ada 500).
- ADR baru: keputusan benchmark & vision sebagai tabel seed; keputusan chatbot non-LLM;
  keputusan TARIF statis; **keputusan dual-driver database**.
- Update `docs/decisions/` + README singkat cara menjalankan (mode PGlite & mode Postgres).

### WS-8 — Dual-Driver Database (PGlite default + PostgreSQL server)
Tujuan: PGlite tetap default tanpa setup, tetapi aplikasi dapat memakai PostgreSQL server
hanya dengan mengeset `DATABASE_URL`, tanpa mengubah skema, migrasi, service, atau route.

- **Abstraksi driver** di `src/lib/db/client.ts`:
  - Jika `DATABASE_URL` ada → gunakan `postgres` (postgres-js) sebagai driver, dibungkus
    Drizzle dengan schema yang sama.
  - Jika tidak → PGlite (`PGLITE_DATA_DIR` atau `.pglite`), perilaku sekarang.
  - Ekspor `db` + `getDb()` tetap sama bentuknya; `getDb()` mengembalikan adapter yang
    memiliki `.query()`/`.exec()` agar `runSeed`/`runMigrations`/route yang memakai raw
    query tetap bekerja di kedua driver.
- **Runner migrasi & seed** disesuaikan agar menerima kedua driver (parameter bertipe
  interface `SqlClient` minimal: `{ query, exec }`), bukan spesifik `PGlite`.
- **Semua query tetap Drizzle + SQL Postgres standar** (sudah begitu) → portabel.
- **Perbedaan perilaku yang didokumentasikan**: PGlite single-process (tanpa replika/HA);
  Postgres server mendukung konkurensi/HA. Tidak ada perbedaan skema/SQL.
- **Dependensi baru**: `postgres` (postgres-js) — hanya dipakai bila `DATABASE_URL` diset.
- **Test dual-mode** (`tests/integration/dual-driver.test.ts`):
  - Selalu: buat klien PGlite in-memory, jalankan migrasi + seed, assert ≥1 baris kunci.
  - Kondisional: jika `DATABASE_URL` diset, jalankan migrasi + seed yang sama ke Postgres
    server dan lakukan assert setara; jika tidak diset, `describe.skip` dengan pesan jelas.
  - Tujuan: membuktikan berkas migrasi `.sql` dan seed **kompatibel di kedua driver**.


---

## 4. Perubahan Skema & API Baru

**Migrasi baru** (`0006_policy_and_reference.sql`):
- `industry_benchmarks (id, metric_code, metric_name, benchmark_value, unit, updated_at)`.
- `policy_knowledge_base (id, topic, question, answer, keywords, category, updated_at)`.
- `ALTER TABLE employees ADD COLUMN contract_end_date DATE`.
- (opsional) `company_vision_mission (id, company_id, vision, mission, updated_at)`.

**Endpoint baru / diubah:**
- `GET /api/v1/analytics/vmai-scorecard` → skor & totalEmployees nyata.
- `GET /api/v1/analytics/benchmark-gap` → baca `industry_benchmarks`.
- `GET /api/v1/analytics/executive-summary` (baru) → metrik kartu eksekutif.
- `GET /api/v1/analytics/lifecycle-summary` (baru) → metrik kartu HR command.
- `GET /api/v1/performance/my-scorecard` (baru) → GPA+komponen employee sendiri.
- `GET /api/v1/performance/team-roster` (baru) → subordinate sesuai scope manager.
- `GET /api/v1/performance/nine-box-summary` (baru) → angka ringkas 9-box.
- `POST /api/v1/governance/chatbot` → engine baru, auth + scope wajib.
- Semua respons tetap `ok/fail` + RFC7807; RBAC via `assertCan`; scope via `scope.ts`.

---

## 5. Non-Goals (di luar lingkup ini)

- Integrasi SSO/SAML, HRIS eksternal, Redis/BullMQ, MinIO/S3 (dijelaskan PRD §12 sebagai
  target enterprise, tetapi tidak diperlukan untuk "siap pakai" versi first-party ini).
- LLM/RAG chatbot (M-11), Moodle LTI nyata (M-10) — tetap ditunda.
- **Redis/BullMQ** tetap ditunda; perlu dicatat bahwa tanpa queue, kalkulasi massal
  (batch GPA ribuan karyawan) berjalan sinkron — cukup untuk skala PGlite/1-node, dan
  menjadi pemicu utama untuk pindah ke Postgres server pada skala besar.
- PGlite **bukan** target deploy multi-server: HA/replika/read-replica tidak termasuk.
  Upgrade ke PostgreSQL server (WS-8) menutup gap ini tanpa tulis ulang kode.
- Tidak dilakukan migrasi data otomatis dari file `.pglite` ke Postgres server (DDL/SQL
  portabel; pemindahan data aktual di luar lingkup ini).

---

## 6. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Seed baru memutus test yang mengandalkan jumlah baris | Update ekspektasi test yang relevan + jalankan seluruh suite per workstream |
| Agregasi live memperlambat dashboard | Query diindeks; cache in-memory sederhana bila perlu; target < 1000ms (PRD §8) |
| Ganti `DUMMY_USERS` memutus login demo | Sediakan `DEMO_LOGIN_ACCOUNTS` eksplisit + test login tetap lulus |
| Chatbot scope bocor data | Uji akses lintas-scope (pola `cross-scope-access.test.ts`) |
| Abstraksi driver dual-mode bocor ke kode domain | Semua konsumen pakai `db`/`getDb()` antarmuka sama; migrasi/seed terima `SqlClient` minimal; test dual-mode mengunci perilaku |

---

## 7. Urutan Eksekusi (dependency-aware)

1. WS-0 (blocker) → 2. WS-5 (kebersihan, kurangi noise) → 3. WS-6 (skema PKWT) →
4. WS-1 (analitik DB) → 5. WS-2 (UI DB-driven, bergantung WS-1) → 6. WS-3 (chatbot) →
7. WS-4 (gating server) → 8. WS-8 (dual-driver DB) → 9. WS-7 (verifikasi & dok).

Setiap workstream: TDD (test dulu) → implement → test hijau → lanjut.
