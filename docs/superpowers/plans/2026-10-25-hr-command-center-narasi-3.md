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

- [ ] **Step 1: Write failing test**

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

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/workloadService.test.ts`
Expected: FAIL (Cannot find module `@/lib/services/workloadService`)

- [ ] **Step 3: Write minimal implementation**

Buat `src/lib/services/workloadService.ts` yang mengagregasi `daily_timesheets` berdasarkan rentang tanggal dan menghitung rasio jam kerja per karyawan.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/workloadService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

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

- [ ] **Step 1: Write failing test**

Buat file `tests/unit/contractService.test.ts` untuk menguji deteksi sisa hari kontrak PKWT.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/contractService.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Implementasikan logika query `employees` dengan `status = 'PKWT'` dan hitung selisih `contract_end_date` terhadap tanggal referensi.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/contractService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

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

- [ ] **Step 1: Write failing test**

Buat test unit untuk rekomendasi aksi (kontrak kritis, evaluasi promosi, intervensi beban kerja).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/hrActionRecommendationService.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Buat aturan rekomendasi berbasis data riil dari beban kerja, kontrak, dan matriks performa.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/hrActionRecommendationService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

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

- [ ] **Step 1: Write failing integration test**

Buat test HTTP handler/route yang memanggil endpoint dan memeriksa struktur JSON response.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/hr-command-center-api.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement API Routes**

Hubungkan route handlers dengan layanan yang telah dibuat di Task 1, 2, dan 3.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/hr-command-center-api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

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

- [ ] **Step 1: Write UI integration test**

Validasi render komponen 5 tab terpadu di `/dashboard/hr-command`.

- [ ] **Step 2: Implement Panels & Tabs**

Integrasikan tab:
1. `Overview & Analytics` (metrik, cost of workforce, flight risk, Gaussian curve)
2. `Lifecycle Control` (pre, during, post-employment panels)
3. `Workload & Timesheet` (`WorkloadAnalysisPanel`)
4. `Career & Action Guidance` (`CareerAndActionsPanel`)
5. `Employee & PKWT Directory` (`PkwtDirectoryPanel`)

- [ ] **Step 3: Run Vitest & Diagnostics**

Run: `npx vitest run tests/integration/hr-command-ui.test.ts`
Run: `npm run lint`

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/hr-command/page.tsx src/components/governance tests/integration/hr-command-ui.test.ts
git commit -m "feat(ui): Command Center HRD Narasi 3 terintegrasi Single Pane of Glass"
```
