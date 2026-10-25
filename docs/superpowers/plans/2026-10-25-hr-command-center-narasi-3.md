# Command Center HRD (Revisi Narasi 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengimplementasikan penyempurnaan Command Center HRD (`/dashboard/hr-command`) sebagai Single Pane of Glass yang mengintegrasikan 7 kapabilitas Narasi 3: seluruh aktivitas kepegawaian, analitik mendalam, manajemen kepegawaian & KPI, pencatatan beban kerja satuan waktu, rekomendasi tindakan & penuntun jenjang karir, kontrol siklus 3-fase, dan direktori detail status PKWT terhubung performa perusahaan.

**Architecture:** Memperluas API backend (`/api/v1/hr/*`) untuk kalkulasi beban kerja (Workload Intensity), peringatan kedaluwarsa kontrak PKWT, dan rekomendasi aksi HRD otomatis. Di frontend, menyatukan navigasi `/dashboard/hr-command` ke dalam 5 tab komprehensif (*Overview & Analytics*, *Lifecycle Control*, *Workload & Timesheet*, *Career & Recommendations*, *Directory & PKWT*) dengan visualisasi interaktif dan modal tindakan instan.

**Tech Stack:** Next.js (App Router, Client Components), Tailwind CSS, Lucide React, PostgreSQL (PGlite di Vitest/Drizzle ORM), TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-25-hr-command-center-narasi-3-design.md`

## Global Constraints

- Standar jam kerja reguler: 40 jam per minggu (8 jam/hari kerja). Jam lembur tercatat maksimal 4 jam/hari sesuai PP 35/2021.
- Toleransi filter kedaluwarsa PKWT: Warning 1 (<60 hari), Warning 2 (<30 hari), Expired (<= 0 hari).
- Semua data mutasi dan rekomendasi aksi harus diaudit dengan `insertAuditLog` mempertahankan rantai hash anti-tampering.
- Tidak boleh menggunakan data dummy hardcoded baru; data ditarik dari tabel PostgreSQL `employees`, `job_positions`, `daily_timesheets`, `kpi_daily_entries`, `individual_kpis`, dan `career_path_levels`.

## Review Focus

1. Karyawan yang tidak memiliki entri timesheet dalam periode tidak boleh menyebabkan pembagian dengan nol (division by zero) pada indeks beban kerja (harus return 0% workload).
2. Perhitungan tanggal kedaluwarsa PKWT harus memperhitungkan zona waktu lokal (WIB/UTC+7) tanpa off-by-one day.
3. Karyawan berstatus selain 'PKWT' (misal: 'TETAP' atau 'PROBATION') harus diabaikan dari peringatan jatuh tempo PKWT.
4. Navigasi pergantian tab di `/dashboard/hr-command` harus mempertahankan state filter pencarian pegawai.
5. Rekomendasi jenjang karir harus menangani kasus posisi puncak (*top-level role*) yang belum memiliki target level lanjutan dalam `career_path_levels`.

---

## Catatan Implementasi (2026-10-25)

Perbaikan yang menyertai penyelesaian rencana ini:

1. **Build rusak diperbaiki.** Fragmen `<>` pada `page.tsx` ditutup sebelum `</ExpandablePanel>` yang dibuka di dalamnya, sehingga `tsc` gagal (TS1003/TS1381/TS17015). Kini typecheck bersih.
2. **Kapasitas beban kerja mengikuti rentang tanggal.** Sebelumnya pembagi selalu 160 jam/bulan, sehingga 35,5 jam dalam 4 hari kerja terbaca 22% (under-utilized) padahal 111%. Sekarang kapasitas = hari kerja dalam rentang × 8 jam.
3. **`NO_DATA` dipisahkan dari `UNDER_UTILIZED`.** Pegawai tanpa entri timesheet tidak lagi dilaporkan "kurang beban"; rata-rata hanya dihitung dari pegawai yang punya data (menutup risiko division-by-zero, Review Focus #1).
4. **PKWT memakai status kanonik v2.** Filter memakai `employment_status = 'PKWT'` (fallback ke `status = 'CONTRACT'` untuk baris legacy), sehingga karyawan non-PKWT tidak lagi muncul dan PKWT yang kolom `status`-nya masih `PROBATION` tetap terdeteksi (Review Focus #3).
5. **Tanggal acuan memakai WIB.** `todayInJakarta()` menggantikan `toISOString()` yang memakai UTC, agar antara 00:00–06:59 WIB tidak mundur sehari (Review Focus #2).
6. **GPA tidak lagi hardcoded.** `currentGpa` dibaca dari `performance_appraisals.composite_gpa` terbaru; tanpa data appraisal syarat GPA dinyatakan belum terpenuhi, bukan diasumsikan 3.5.
7. **Rule engine melengkapi 4 tipe rekomendasi.** `PROMOTION_READINESS` dan `DOCUMENT_PENDING` kini dihasilkan dari data nyata, dan hasil diurutkan berdasarkan prioritas.
8. **Endpoint diautentikasi + RBAC + scope.** Keempat route Narasi 3 mengikuti konvensi `getAuthSession`/`assertCan`/`ok`-`fail` (sebelumnya tanpa auth dan memakai bentuk `{success:true}` yang tidak dipakai route lain). Panduan karir dibatasi `resolveVisibleEmployeeIds` sehingga karyawan tidak dapat membaca data pegawai lain.
9. **Panel UI membaca `status: 'success'`.** Sebelumnya membaca `json.success` sehingga tidak pernah menampilkan data. Ditambah penanganan error, filter status, dan penampil kesiapan jenjang karir.
10. **Deep-link berfungsi.** `?tab=`, `?employeeId=`, dan `?search=` dibaca halaman sehingga tautan dari rekomendasi HRD langsung membuka tab yang tepat (Review Focus #4).

Verifikasi: `npx tsc --noEmit` bersih; 28 test Narasi 3 lulus (5 file).

---

## Audit Kesesuaian 7 Pilar (2026-10-25, putaran 2)

Audit ini dilakukan dengan membaca kode, bukan mengandalkan ingatan. Temuan awal: **commit `6f5321b` belum memenuhi ketujuh pilar.** Tiga masalah pokok:

| Pilar | Kondisi sebelum audit | Tindakan |
|---|---|---|
| 1. Aktivitas kepegawaian menyeluruh | Belum ada UI aktivitas; `CompanyActivityFeed` hanya di panel Cost & Risk yang harus dibuka manual | `HrLifecycleControlPanel` fase Saat-Kerja memuat log aktivitas lintas modul |
| 2. Analitik komprehensif | `GaussianCurve` dan `NineBoxGrid` **ada tapi tidak dipakai di mana pun** | Keduanya dirender di tab Overview; ditambah GPA & potensi tinggi dari `executive-summary` |
| 3. Manajemen kepegawaian | Tidak ada headcount/gender/usia/grade/KPI/MPP | Service + endpoint `workforce-profile` baru, ditampilkan di tab Overview |
| 4. Beban kerja satuan waktu | Ada, tetapi kapasitas salah (lihat catatan 2) | Diperbaiki; kini mengikuti hari kerja pada rentang |
| 5. Rekomendasi & jenjang karir | 2 dari 4 tipe rekomendasi belum ada; skill gap belum dihitung | 4 tipe lengkap; skill gap dari `competency_scores` |
| 6. Kontrol siklus 3-fase | Tab `lifecycle` merender isi **identik** dengan `overview` | `HrLifecycleControlPanel` dengan fase Pra/Saat/Pasca yang benar-benar berbeda |
| 7. Pencarian, detail, PKWT, kontribusi BSC | Tidak ada direktori & pemetaan ke pilar BSC | `EmployeeDirectoryPanel` + endpoint `bsc-contribution` |

### Perbaikan tambahan pada putaran ini

11. **Tab `overview` dan `lifecycle` dipisahkan.** Sebelumnya keduanya memakai kondisi `(mainTab === 'overview' || mainTab === 'lifecycle')` sehingga menampilkan grid yang sama.
12. **`contract_start_date` ditambahkan** lewat migrasi `0056` (aditif + idempoten). Sebelumnya kolom ini tidak ada sehingga rentang kontrak tidak bisa ditampilkan.
13. **Skill gap memakai data nyata.** Klaim lama "belum ada tabel pemetaan skill" **keliru**: `competency_scores` menyimpan `skill_name`, `required_level`, `actual_level`, `gap`. Kini skill dipisah menjadi `verifiedSkills` / `missingSkills` / `unverifiedSkills` agar skill yang belum diasesmen tidak disalahartikan sebagai kekurangan.
14. **ESLint dikonfigurasi.** `eslint` + `eslint-config-next` dipasang, `.eslintrc.json` dibuat, dan 3 pelanggaran lama diperbaiki (`JobBoardModal`, `InternalApplicationReview`, `resumeParser`). `npm run lint` kini berjalan dan bersih.
15. **BOM dihapus dari seluruh file** yang ditulis pada commit sebelumnya. `Set-Content -Encoding utf8` di PowerShell 5.1 menyisipkan BOM; akibatnya migrasi SQL gagal dengan `syntax error at or near "\ufeff"`.
16. **Endpoint direktori terpisah.** `/api/v1/hr/employees` mensyaratkan `recruitment:manage` (BOD/AUDITOR ditolak), sehingga direktori memakai `/api/v1/hr/employee-directory` dengan `employment:read` dan penolakan eksplisit untuk peran `EMPLOYEE`.
17. **File sisa dibersihkan:** `a.txt`, `c.txt`, `scripts/tmp-inspect*.mjs`.

### Verifikasi putaran ini

- `npx tsc --noEmit` → bersih.
- `npm run lint` → **No ESLint warnings or errors**.
- 61 test Narasi 3 lulus (10 file) + 47 test regresi lulus (6 file).
- Verifikasi endpoint nyata dengan sesi HR pada dev server: `workforce-profile`, `employee-directory`, `contracts-summary`, `action-recommendations`, `bsc-contribution` → semuanya HTTP 200.
- Verifikasi SSR `/dashboard/hr-command` dengan sesi HR → kelima label tab muncul.
- **Catatan jujur:** verifikasi visual (screenshot) tidak dapat dilakukan karena tool browser sesi ini tidak mendukung penyetelan cookie httpOnly dan paket `playwright` tidak terpasang sebagai dependensi proyek. Yang diverifikasi adalah render server-side, struktur DOM via jsdom, dan respons API nyata.

---

### Task 1: Layanan Analisis Beban Kerja & Satuan Waktu (`workloadService`)

**Files:**
- Create: `src/lib/services/workloadService.ts`
- Test: `tests/unit/workloadService.test.ts`

**Interfaces:**
- Produces: `calculateWorkloadSummary(db: Db, options?: { departmentId?: string; fromDate?: string; toDate?: string }): Promise<WorkloadSummaryResult>`
- Return Type:
  ```ts
  export interface EmployeeWorkload {
    employeeId: string;
    fullName: string;
    departmentName: string;
    totalRegularHours: number;
    totalOvertimeHours: number;
    workloadIntensityPercentage: number;
    status: 'UNDER_UTILIZED' | 'OPTIMAL' | 'OVER_UTILIZED';
  }
  export interface WorkloadSummaryResult {
    averageHours: number;
    averageIntensity: number;
    overUtilizedCount: number;
    underUtilizedCount: number;
    employees: EmployeeWorkload[];
  }
  ```

- [x] **Step 1: Write failing test**

Buat file `tests/unit/workloadService.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { calculateWorkloadSummary } from '@/lib/services/workloadService';

describe('Workload Service - Satuan Waktu & Intensitas Beban Kerja', () => {
  let client: PGlite;
  let db: Db;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  });

  afterAll(async () => {
    await client.close();
  });

  it('menghitung rata-rata jam dan intensitas beban kerja dengan benar', async () => {
    const summary = await calculateWorkloadSummary(db);
    expect(summary).toBeDefined();
    expect(summary.averageIntensity).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(summary.employees)).toBe(true);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/workloadService.test.ts`
Expected: FAIL (Cannot find module `@/lib/services/workloadService`)

- [x] **Step 3: Write minimal implementation**

Buat `src/lib/services/workloadService.ts` yang mengagregasi `daily_timesheets` berdasarkan rentang tanggal dan menghitung rasio jam kerja per karyawan.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/workloadService.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/lib/services/workloadService.ts tests/unit/workloadService.test.ts
git commit -m "feat(workload): implementasi perhitungan utilisasi beban kerja pegawai"
```

---

### Task 2: Layanan Manajemen Kontrak PKWT & Peringatan Jatuh Tempo (`contractService`)

**Files:**
- Create: `src/lib/services/contractService.ts`
- Test: `tests/unit/contractService.test.ts`

**Interfaces:**
- Produces: `getContractsSummary(db: Db, refDate?: string): Promise<ContractsSummaryResult>`
- Return Type:
  ```ts
  export interface PkwtContractAlert {
    employeeId: string;
    fullName: string;
    departmentName: string;
    positionTitle: string;
    contractEndDate: string;
    daysRemaining: number;
    urgency: 'EXPIRED' | 'CRITICAL_30' | 'WARNING_60' | 'SAFE';
  }
  export interface ContractsSummaryResult {
    totalPkwt: number;
    expiringIn30Days: number;
    expiringIn60Days: number;
    expiredCount: number;
    alerts: PkwtContractAlert[];
  }
  ```

- [x] **Step 1: Write failing test**

Buat file `tests/unit/contractService.test.ts` untuk menguji deteksi sisa hari kontrak PKWT.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/contractService.test.ts`
Expected: FAIL

- [x] **Step 3: Write minimal implementation**

Implementasikan logika query `employees` dengan `status = 'PKWT'` dan hitung selisih `contract_end_date` terhadap tanggal referensi.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/contractService.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/lib/services/contractService.ts tests/unit/contractService.test.ts
git commit -m "feat(contracts): deteksi dan ringkasan jatuh tempo kontrak PKWT"
```

---

### Task 3: Mesin Rekomendasi Tindakan HRD & Panduan Karir (`hrActionRecommendationService`)

**Files:**
- Create: `src/lib/services/hrActionRecommendationService.ts`
- Test: `tests/unit/hrActionRecommendationService.test.ts`

**Interfaces:**
- Produces:
  - `getActionRecommendations(db: Db): Promise<HrActionRecommendation[]>`
  - `getCareerGuidanceForEmployee(db: Db, employeeId: string): Promise<CareerGuidanceResult>`

- [x] **Step 1: Write failing test**

Buat test unit untuk rekomendasi aksi (kontrak kritis, evaluasi promosi, intervensi beban kerja).

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/hrActionRecommendationService.test.ts`
Expected: FAIL

- [x] **Step 3: Write minimal implementation**

Buat aturan rekomendasi berbasis data riil dari beban kerja, kontrak, dan matriks performa.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/hrActionRecommendationService.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/lib/services/hrActionRecommendationService.ts tests/unit/hrActionRecommendationService.test.ts
git commit -m "feat(hr-actions): rule engine rekomendasi tindakan HRD dan bimbingan karir"
```

---

### Task 4: API Endpoints untuk Command Center HRD Narasi 3

**Files:**
- Create: `src/app/api/v1/hr/workload-summary/route.ts`
- Create: `src/app/api/v1/hr/contracts-summary/route.ts`
- Create: `src/app/api/v1/hr/action-recommendations/route.ts`
- Create: `src/app/api/v1/hr/career-guidance/[id]/route.ts`
- Test: `tests/integration/hr-command-center-api.test.ts`

- [x] **Step 1: Write failing integration test**

Buat test HTTP handler/route yang memanggil endpoint dan memeriksa struktur JSON response.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/hr-command-center-api.test.ts`
Expected: FAIL

- [x] **Step 3: Implement API Routes**

Hubungkan route handlers dengan layanan yang telah dibuat di Task 1, 2, dan 3.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/hr-command-center-api.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/app/api/v1/hr tests/integration/hr-command-center-api.test.ts
git commit -m "feat(api): endpoint pendukung Command Center HRD Narasi 3"
```

---

### Task 5: UI Unifikasi Command Center HRD di `/dashboard/hr-command`

**Files:**
- Modify: `src/app/dashboard/hr-command/page.tsx`
- Create: `src/components/governance/WorkloadAnalysisPanel.tsx`
- Create: `src/components/governance/CareerAndActionsPanel.tsx`
- Create: `src/components/governance/PkwtDirectoryPanel.tsx`
- Test: `tests/integration/hr-command-ui.test.ts`

- [x] **Step 1: Write UI integration test**

Validasi render komponen 5 tab terpadu di `/dashboard/hr-command`.

- [x] **Step 2: Implement Panels & Tabs**

Integrasikan tab:
1. `Overview & Analytics` (metrik, cost of workforce, flight risk, Gaussian curve)
2. `Lifecycle Control` (pre, during, post-employment panels)
3. `Workload & Timesheet` (`WorkloadAnalysisPanel`)
4. `Career & Action Guidance` (`CareerAndActionsPanel`)
5. `Employee & PKWT Directory` (`PkwtDirectoryPanel`)

- [x] **Step 3: Run Vitest & Diagnostics**

Run: `npx vitest run tests/integration/hr-command-ui.test.ts`
Run: `npm run lint`

- [x] **Step 4: Commit**

```bash
git add src/app/dashboard/hr-command/page.tsx src/components/governance tests/integration/hr-command-ui.test.ts
git commit -m "feat(ui): Command Center HRD Narasi 3 terintegrasi Single Pane of Glass"
```

