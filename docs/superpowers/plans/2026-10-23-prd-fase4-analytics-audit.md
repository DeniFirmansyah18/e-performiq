# Fase 4 — Strategic Analytics Engine & Audit Keamanan

**Spec:** `PRD_Sistem_Penilaian_Karyawan (PT).md` v2.0.0
**Roadmap:** §9 Fase 4 (Strategic Analytics Engine, Audit Keamanan) — Bulan 6.
**Prasyarat:** Fase 1–3 (28 task) selesai; 9 poin gap map tertutup.

## Mengapa fase ini

Audit terhadap §5.4 Modul 4 menemukan dua butir yang belum ada kode-nya:

1. **Predictive Attrition & Burnout Warning** — tidak ada engine, service,
   endpoint, maupun UI. Yang ada hanya satu string peringatan statis di
   `coreHrService` ("beban lembur berlebih berisiko memicu burnout") yang
   tidak menghitung apa pun.
2. **Audit Trail anti-tamper** — `audit_logs` sudah immutable lewat trigger
   `trg_audit_logs_immutable`, tetapi tidak ada bukti kriptografis. Pemegang
   hak DBA dapat mematikan trigger lalu mengubah baris tanpa terdeteksi.

Butir §5.4 lainnya (Vision & Mission Radar Chart) sudah ada:
`/api/v1/analytics/benchmark-gap` + `RadarChartBSC`.

## Global Constraints

- Migrasi idempoten: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
  `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`.
- Target TS `es5`: tanpa `for...of` atas `Map`/`Buffer`/`matchAll`; pakai
  indeks atau `Array.from`.
- Uji yang menyentuh DB memakai `createTestDb()` (PGlite terisolasi) atau
  `getDb()` + `runSeed` sesuai konvensi berkas tetangga.
- `tests/unit/schema.test.ts` mematok jumlah tabel & enum — perbarui bila
  menambah tabel.
- Data sensitif: tidak ada angka gaji/BPJS di keluaran risiko; hanya sinyal
  kehadiran & kinerja.

## Task 1 — Engine risiko (`src/lib/engines/flightRiskEngine.ts`)

Pure function, tanpa I/O.

```ts
export type RiskBand = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export interface RiskFactor { code: string; label: string; points: number; maxPoints: number }
export interface RiskSignals {
  absentDays30: number; lateDays30: number; redDays30: number;
  overtimeHours30: number; longestWorkStreak: number;
  avgDpi30: number | null; dpiTrend: number | null; entryAdherence: number | null;
  tenureMonths: number;
}
export interface RiskResult { score: number; band: RiskBand; factors: RiskFactor[] }
export function bandFor(score: number): RiskBand
export function computeAttritionRisk(s: RiskSignals): RiskResult
export function computeBurnoutRisk(s: RiskSignals): RiskResult
export function computeFlightRisk(s: RiskSignals): { attrition: RiskResult; burnout: RiskResult; overall: RiskBand }
```

Bobot attrition (maksimum 100): `ABSENCE` min(absent,10)×3 (30),
`LOW_DPI` <70→20 / <85→10 (20), `RED_DAYS` min(red,10)×2 (20),
`DPI_DECLINE` ≤−5→15 / <0→8 (15), `LOW_ADHERENCE` <0.6→10 (10),
`EARLY_TENURE` tenure<12 && avgDpi<75→5 (5).

Bobot burnout (maksimum 100): `OVERTIME_LOAD` ≥40h→40 / ≥20h→25 / ≥10h→12 (40),
`LONG_STREAK` ≥12 hari→20 (20), `LATE_FATIGUE` min(late,10)×2 (20),
`RED_DAYS` min(red,10)×1 (10), `DPI_DECLINE` <0→10 (10).

Band: `LOW` <25, `MODERATE` 25–49, `HIGH` 50–74, `CRITICAL` ≥75.
`overall` = band tertinggi dari kedua skor.

**Test:** `tests/unit/flightRiskEngine.test.ts` — nilai persis untuk kasus
nihil, campuran, dan ekstrem; batas band 24/25, 49/50, 74/75; `dpiTrend`
negatif vs positif; `avgDpi30` null tidak menghasilkan `LOW_DPI`.

## Task 2 — Migrasi `0054_flight_risk.sql`

Tabel `employee_flight_risk_snapshots` (id, employee_id, snapshot_date,
attrition_score, attrition_band, burnout_score, burnout_band, factors JSONB,
computed_at, UNIQUE(employee_id, snapshot_date)) + indeks
`(snapshot_date, attrition_band)` dan `(snapshot_date, burnout_band)`.
Bump hitungan skema: 109→110 tabel.

**Test:** `tests/unit/schema.test.ts` (diperbarui) + query kolom.

## Task 3 — Service `src/lib/services/flightRiskService.ts`

```ts
export interface RiskRow { employeeId: string; fullName: string; departmentName: string;
  attritionScore: number; attritionBand: RiskBand; burnoutScore: number; burnoutBand: RiskBand;
  factors: RiskFactor[]; snapshotDate: string }
export async function collectSignals(db: Db, employeeId: string, asOf: string): Promise<RiskSignals>
export async function computeAndStoreRisk(db: Db, employeeId: string, asOf: string): Promise<RiskRow>
export async function recomputeAllRisks(db: Db, asOf: string): Promise<{ processed: number; skipped: number }>
export async function listFlightRisk(db: Db, opts?: { band?: RiskBand; departmentId?: string; limit?: number }): Promise<RiskRow[]>
```

Sinyal diambil dari data nyata: `attendance_records` (absen, terlambat,
streak), `attendance_logs.total_overtime_hours` (lembur 30 hari),
`daily_performance_snapshots` (hari merah, rata-rata DPI, tren 7 hari vs 7
hari sebelumnya, `entry_adherence`), `employees.join_date` (masa kerja).
Karyawan tanpa data → skor 0 / `LOW`, bukan `NO_DATA` palsu.

**Test:** `tests/integration/flightRiskService.test.ts` — dua karyawan
kontras (satu sehat, satu absen+lembur tinggi+DPI merah) menghasilkan band
berbeda; recompute idempoten (baris `UNIQUE` di-upsert, jumlah baris tetap).

## Task 4 — API

- `GET /api/v1/analytics/flight-risk?band=&department_id=&limit=` —
  permission `analytics:read`.
- `POST /api/v1/analytics/flight-risk/recompute` — permission baru
  `analytics:manage` (SUPER_ADMIN, HR_MANAGER), body `{ as_of?: 'YYYY-MM-DD' }`.

**Test:** `tests/api/flight-risk-routes.test.ts` — 401 tanpa sesi, 403 untuk
EMPLOYEE, 200 + bentuk data untuk HR, `band` filter bekerja, recompute
menulis snapshot.

## Task 5 — UI `src/components/governance/FlightRiskPanel.tsx`

Kartu "Peringatan Dini Attrition & Burnout": ringkasan per band, daftar
karyawan berisiko dengan dua bar skor, dan tombol "Hitung ulang". Warna
mengikuti token status yang sudah ada (`GREEN/YELLOW/RED`).

Dipasang di `/dashboard/executive` dan `/dashboard/hr-command`.

**Test:** `tests/ui/flight-risk-panel.test.tsx` (jsdom) — merender daftar,
menampilkan band, tombol memanggil endpoint recompute.

## Task 6 — Audit anti-tamper (hash chain)

Migrasi `0055_audit_hash_chain.sql`: `entry_hash CHAR(64)`, `prev_hash
CHAR(64)` + indeks. Baris lama (`entry_hash IS NULL`) dianggap warisan dan
dilewati verifikasi.

`insertAuditLog` menulis dalam satu transaksi: ambil id dari
`nextval(pg_get_serial_sequence('audit_logs','id'))`, ambil `entry_hash`
baris terakhir, hitung
`sha256(prev|id|userId|actionType|entityName|recordId|description|createdAtIso)`
lalu insert dengan id + `created_at` eksplisit.

`verifyAuditChain(db)` mengembalikan `{ ok, checked, legacy, firstBrokenId }`.
Endpoint `GET /api/v1/audit/integrity` (permission `audit:read`) + badge di
`/dashboard/audit-governance`.

**Test:** `tests/integration/auditChain.test.ts` — rantai baru valid; setelah
baris diubah paksa (trigger dimatikan) verifikasi menunjuk id yang rusak;
baris warisan tidak dianggap rusak.

## Completion

`npx vitest run` hijau, `npx tsc --noEmit` 0 error, `npm run build` sukses,
`npm run db:reset` 55 migrasi OK.
