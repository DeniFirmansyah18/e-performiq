# E-PerformIQ Database & Flow Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menjadikan alur During-Employment (KPI → persetujuan → realisasi → GPA → kalibrasi) benar-benar berjalan di atas PostgreSQL nyata dengan autentikasi dan otorisasi per-role yang ditegakkan.

**Architecture:** Lima lapisan dengan dependensi satu arah: route (controller tipis) → service (logika bisnis + transaksi) → repository (akses data) → Drizzle + PGlite. Engine perhitungan tetap fungsi murni tanpa I/O sehingga dapat diuji tanpa database. Otorisasi ditegakkan di dua tingkat: role (boleh memanggil endpoint?) dan baris (boleh melihat baris ini?).

**Tech Stack:** Next.js 14.2 (App Router), TypeScript 5.6, PGlite (`@electric-sql/pglite`), Drizzle ORM, `jose` (JWT), `bcryptjs`, `zod`, TanStack Query v5, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-21-eperformiq-database-and-flow-integration-design.md`

## Global Constraints

- **Runtime database:** setiap route yang menyentuh DB wajib `export const runtime = 'nodejs'` dan `export const dynamic = 'force-dynamic'`. PGlite adalah WASM dan gagal di Edge runtime.
- **PGlite single-connection:** query diserialisasi internal. Jangan pernah membuka lebih dari satu instance PGlite dengan `dataDir` yang sama dalam satu proses.
- **Titik tukar driver tunggal:** hanya `src/lib/db/client.ts` yang boleh mengimpor `@electric-sql/pglite` atau `drizzle-orm/pglite`. File lain mengimpor `db` dari sana.
- **Engine tetap murni:** `src/lib/engines/*.ts` tidak boleh mengimpor apa pun dari `src/lib/db/`, `src/lib/repositories/`, atau `next/*`.
- **Envelope response:** sukses `{ status: 'success', data: {...} }`. Error mengikuti RFC 7807: `{ type, title, status, detail, instance, timestamp }`.
- **Kode status:** `400` input tidak valid secara sintaks, `401` belum terautentikasi, `403` role tidak berwenang, `404` tidak ditemukan, `409` pelanggaran immutability, `422` input valid secara sintaks tapi melanggar aturan bisnis.
- **Nama tabel & kolom:** `snake_case` di database, `camelCase` di TypeScript. Drizzle memetakan lewat opsi `columns`.
- **Bahasa pesan error:** Bahasa Indonesia, sesuai pesan yang sudah ada di codebase.
- **Password demo:** seluruh 6 user seed memakai password `enterprise2026`, di-hash bcrypt cost 10.
- **Jangan commit** `.pglite/`, `node_modules/`, `.next/`.

## Review Focus

Input dan kondisi yang spec tidak sebutkan secara eksplisit, tapi paling mungkin menggigit pengguna. Setiap baris punya tes yang dipasang di task pemilik kodenya.

1. **`actual_value` negatif pada KPI** — pembagian `actual/target` menghasilkan `achievement_percentage` negatif. Yang diharapkan: nilai negatif ditolak `422`, bukan disimpan.
2. **Total bobot KPI melebihi 100%** — karyawan menambah KPI kelima sehingga total 110%. Yang diharapkan: `422` dengan pesan yang menyebut total saat ini.
3. **`manager_id` melingkar** (A atasan B, B atasan A) — penelusuran bawahan rekursif tidak pernah berhenti. Yang diharapkan: query berhenti pada kedalaman 5 dan tidak menggantung.
4. **Token JWT kedaluwarsa atau tanda tangan rusak** — cookie ada tapi tidak valid. Yang diharapkan: `401` dan cookie dibersihkan, bukan `500`.
5. **`employee_id` di query string milik orang lain** — karyawan menebak ID rekan kerjanya. Yang diharapkan: `403`, bukan data orang lain.

---

## Penyimpangan dari Spec

| Spec | Plan | Alasan |
|---|---|---|
| §3: "`drizzle-kit` untuk migrasi" | Migrasi memakai SQL mentah di `src/lib/db/migrations/`; Drizzle hanya untuk query | Generated column (`achievement_percentage`) dan trigger immutability tidak dapat diekspresikan lewat drizzle-kit. `drizzle-kit` tetap dipasang untuk `drizzle-kit studio` (inspeksi visual) |
| §11 langkah 1: "verifikasi PGlite hidup lewat skrip kecil" | Digabung ke Task 1 sebagai tes Vitest | Skrip sekali pakai tidak memberi nilai jangka panjang; tes Vitest dapat dijalankan ulang |

---

## File Structure

**Dibuat:**

| File | Tanggung jawab |
|---|---|
| `src/lib/db/client.ts` | Singleton PGlite + Drizzle; satu-satunya importer driver |
| `src/lib/db/migrate.ts` | Menjalankan file SQL di `migrations/` secara berurutan |
| `src/lib/db/migrations/0001_init.sql` | 24 tabel, 7 enum, index, trigger |
| `src/lib/db/schema/index.ts` | Barrel ekspor seluruh definisi tabel |
| `src/lib/db/schema/organization.ts` | `companies`, `departments`, `job_positions`, `employees`, `users` |
| `src/lib/db/schema/strategy.ts` | `strategic_pillars`, `corporate_kpis`, `division_kpis` |
| `src/lib/db/schema/performance.ts` | `appraisal_periods`, `individual_kpis`, `sop_compliance_logs`, `competency_scores`, `peer_reviews_360`, `performance_appraisals` |
| `src/lib/db/schema/governance.ts` | `audit_logs` |
| `src/lib/db/schema/lifecycle.ts` | 9 tabel Pre/Post-Employment (dibuat, belum dipakai) |
| `src/lib/db/seed/index.ts` | Seed idempoten dari `dummy-data` |
| `src/lib/auth/password.ts` | `hashPassword`, `verifyPassword` |
| `src/lib/auth/session.ts` | `signSession`, `verifySession`, `getSessionFromCookies` |
| `src/lib/auth/rbac.ts` | Matriks role → permission |
| `src/lib/auth/scope.ts` | `resolveVisibleEmployeeIds` (row-level) |
| `src/lib/auth/errors.ts` | `AuthError`, `ForbiddenError`, `ImmutableRecordError`, `BusinessRuleError` |
| `src/lib/api/response.ts` | `ok()`, `problem()` |
| `src/lib/api/validate.ts` | `parseBody()` pembungkus zod |
| `src/lib/repositories/employeeRepository.ts` | Query karyawan + hierarki |
| `src/lib/repositories/kpiRepository.ts` | Query KPI |
| `src/lib/repositories/appraisalRepository.ts` | Query appraisal |
| `src/lib/repositories/auditRepository.ts` | Append audit log |
| `src/lib/services/kpiService.ts` | Aturan bisnis KPI |
| `src/lib/services/appraisalService.ts` | Perhitungan GPA + kalibrasi |
| `src/lib/services/auditService.ts` | Pencatatan audit |
| `src/lib/hooks/useSession.ts` | TanStack Query: sesi aktif |
| `src/lib/hooks/useKPIs.ts` | TanStack Query: daftar KPI + mutasi |
| `src/lib/hooks/useAppraisal.ts` | TanStack Query: appraisal + kalibrasi |
| `src/lib/queryClient.ts` | Konfigurasi QueryClient |
| `src/middleware.ts` | Redirect belum-login → `/login` |
| `vitest.config.ts` | Konfigurasi Vitest |
| `tests/setup.ts` | Helper PGlite in-memory + migrasi |
| `tests/unit/*.test.ts` | Tes engine & RBAC |
| `tests/integration/*.test.ts` | Tes service + repository |
| `tests/api/*.test.ts` | Tes route handler |

**Dimodifikasi:**

| File | Perubahan |
|---|---|
| `package.json` | Dependensi + skrip `db:migrate`, `db:seed`, `db:reset`, `test` |
| `src/types/index.ts` | `department` → `departmentId`; tambah `KpiStatus`; hapus field turunan dari `Employee` |
| `src/lib/engines/vmai-engine.ts` | Hapus angka hardcoded |
| `src/lib/engines/severance-engine.ts` | Tambah `calculateServiceYears` |
| `src/lib/context/AuthContext.tsx` | Baca sesi dari API, buang `localStorage` |
| `src/app/login/page.tsx` | Login lewat API |
| `src/app/dashboard/manager-cockpit/page.tsx` | Approve KPI lewat API |
| `src/app/dashboard/employee-portal/page.tsx` | Realisasi KPI lewat API |
| `src/components/navigation/Sidebar.tsx` | Saring menu per-role |
| `src/app/api/v1/auth/login/route.ts` | JWT asli + bcrypt |
| `src/app/api/v1/performance/individual-kpis/route.ts` | DB + RBAC |
| `src/app/api/v1/performance/appraisals/calculate-gpa/route.ts` | DB + RBAC |
| `src/app/api/v1/performance/appraisals/[id]/calibrate/route.ts` | DB + immutability |
| `src/app/api/v1/governance/audit-logs/route.ts` | DB + RBAC |
| `src/app/layout.tsx` | Bungkus dengan `QueryClientProvider` |

**Dihapus:**

| File | Alasan |
|---|---|
| `src/lib/context/AppContext.tsx` | 276 baris state in-memory digantikan TanStack Query |

**Urutan dependensi antar-task:**

```
Task 1 (Fondasi) → Task 2 (Schema) → Task 3 (Seed)
                                        ↓
                   Task 4 (Auth primitives) → Task 5 (RBAC + scope)
                                        ↓
                   Task 6 (Repository+Service KPI) → Task 7 (Service GPA+Kalibrasi)
                                        ↓
                   Task 8 (Route KPI) → Task 9 (Route Appraisal) → Task 10 (Route Audit)
                                        ↓
                   Task 11 (UI wiring) → Task 12 (Verifikasi akhir)
```

Setiap task hanya bergantung pada task bernomor lebih kecil.

---

### Task 1: Fondasi — Git, Dependensi, Klien Database

**Files:**
- Create: `src/lib/db/client.ts`
- Create: `vitest.config.ts`
- Create: `tests/unit/db-client.test.ts`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: tidak ada (task pertama)
- Produces: `db` (instance Drizzle), tipe `Db`, skrip npm `test` & `test:watch`

- [ ] **Step 1: Inisialisasi git dan commit kondisi awal**

```bash
cd "e:/PRD Penilaian Karyawan/Penilaian Karyawan PT"
git init
git add -A
git commit -m "chore: kondisi awal prototype E-PerformIQ"
```

- [ ] **Step 2: Buat `.gitignore`**

```
node_modules/
.next/
.pglite/
.env
.env.local
*.tsbuildinfo
```

- [ ] **Step 3: Pasang dependensi**

```bash
npm install @electric-sql/pglite@^0.2.17 drizzle-orm@^0.36.4 jose@^5.9.6 bcryptjs@^2.4.3 zod@^3.23.8 @tanstack/react-query@^5.59.16
npm install -D vitest@^2.1.4 tsx@^4.19.2 drizzle-kit@^0.28.1 @types/bcryptjs@^2.4.6
```

- [ ] **Step 4: Tambah skrip npm**

Pada `package.json`, ganti blok `"scripts"` menjadi:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate": "tsx src/lib/db/migrate.ts",
    "db:seed": "tsx src/lib/db/seed/index.ts",
    "db:reset": "node -e \"require('fs').rmSync('.pglite',{recursive:true,force:true})\" && npm run db:migrate && npm run db:seed"
  }
}
```

- [ ] **Step 5: Buat konfigurasi Vitest**

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // PGlite memuat WASM saat inisialisasi pertama; butuh beberapa detik.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
});
```

- [ ] **Step 6: Tulis tes yang gagal**

`tests/unit/db-client.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

describe('klien database', () => {
  it('menyalakan PGlite dan melaporkan versi PostgreSQL', async () => {
    const client = new PGlite();
    const result = await client.query<{ version: string }>('SELECT version()');
    await client.close();

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].version).toContain('PostgreSQL');
  });

  it('mengekspor instance db dari client.ts', async () => {
    const { db } = await import('@/lib/db/client');
    expect(db).toBeDefined();
  });
});
```

- [ ] **Step 7: Jalankan tes untuk memastikan gagal**

```bash
npx vitest run tests/unit/db-client.test.ts
```

Diharapkan: tes pertama **LULUS** (membuktikan PGlite berjalan di mesin ini), tes kedua **GAGAL** dengan `Cannot find module '@/lib/db/client'`.

- [ ] **Step 8: Buat klien database**

`src/lib/db/client.ts`:

```ts
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

const globalForDb = globalThis as unknown as {
  __eperformiqDb?: ReturnType<typeof createDb>;
};

function createDb() {
  const dataDir = process.env.PGLITE_DATA_DIR ?? '.pglite';
  return drizzle(new PGlite(dataDir));
}

/**
 * Wajib singleton: Next.js dev me-reload modul, dan setiap reload membuat
 * instance PGlite baru sehingga koneksi menumpuk serta file dataDir terkunci.
 */
export const db = globalForDb.__eperformiqDb ?? createDb();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__eperformiqDb = db;
}

export type Db = typeof db;
```

- [ ] **Step 9: Jalankan tes untuk memastikan lulus**

```bash
npx vitest run tests/unit/db-client.test.ts
```

Diharapkan: **2 tes LULUS**.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: fondasi database PGlite + Drizzle dan konfigurasi Vitest"
```

---

### Task 2: Migrasi SQL — 24 Tabel, 7 Enum, Trigger Immutability

**Files:**
- Create: `src/lib/db/migrations/0001_init.sql`
- Create: `src/lib/db/migrate.ts`
- Create: `tests/setup.ts`
- Create: `tests/integration/schema.test.ts`

**Interfaces:**
- Consumes: `db` dari Task 1
- Produces:
  - `runMigrations(client: PGlite): Promise<void>`
  - `createTestDb(): Promise<{ db: Db; client: PGlite }>` dari `tests/setup.ts`

- [ ] **Step 1: Tulis skema SQL**

`src/lib/db/migrations/0001_init.sql`. SQL mentah, bukan drizzle-kit, karena generated column dan trigger tidak dapat diekspresikan lewat drizzle-kit (lihat Penyimpangan dari Spec).

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================== ENUM (7) ==============================
CREATE TYPE bsc_perspective_enum AS ENUM
  ('FINANCIAL','CUSTOMER','INTERNAL_PROCESS','LEARNING_GROWTH');
CREATE TYPE employee_status_enum AS ENUM
  ('PROBATION','PERMANENT','CONTRACT','RESIGNED','RETIRED');
CREATE TYPE user_role_enum AS ENUM
  ('SUPER_ADMIN','BOD','HR_MANAGER','PEOPLE_MANAGER','EMPLOYEE','AUDITOR');
CREATE TYPE period_status_enum AS ENUM
  ('DRAFT','ACTIVE','CALIBRATION','LOCKED');
CREATE TYPE nine_box_quadrant_enum AS ENUM
  ('ENIGMA','GROWTH_STAR','FUTURE_LEADER','DILEMMA','CORE_PLAYER',
   'HIGH_IMPACT','UNDERPERFORMER','EFFECTIVE_PRO','TRUSTED_PRO');
CREATE TYPE offboarding_status_enum AS ENUM
  ('INITIATED','CLEARANCE_IN_PROGRESS','COMPLETED','DISPUTED');
-- Perbaikan §5.1 butir 8: PRD tidak punya kolom status KPI, padahal
-- types/index.ts mendefinisikannya dan alur persetujuan mustahil tanpanya.
CREATE TYPE kpi_status_enum AS ENUM
  ('DRAFT','SUBMITTED','APPROVED','REJECTED');

-- ============ ORGANISASI (perbaikan §5.1 butir 1: tabel ini
-- direferensikan FK di PRD tapi tidak pernah didefinisikan) ============
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(200) NOT NULL,
  legal_entity_code VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  department_name VARCHAR(200) NOT NULL,
  division_name VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE job_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  position_title VARCHAR(200) NOT NULL,
  job_grade VARCHAR(20),
  competency_dictionary JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  phone_number VARCHAR(30),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  position_id UUID NOT NULL REFERENCES job_positions(id) ON DELETE RESTRICT,
  manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  status employee_status_enum DEFAULT 'PROBATION',
  base_salary DECIMAL(15,2) NOT NULL CHECK (base_salary >= 0),
  join_date DATE NOT NULL,
  last_working_day DATE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- employee_id sengaja nullable: SUPER_ADMIN tidak punya baris employee.
-- PostgreSQL mengizinkan banyak NULL pada kolom UNIQUE (§5.1 butir 5).
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role user_role_enum NOT NULL DEFAULT 'EMPLOYEE',
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ================== STRATEGIS (Cascade Level 1-3) ====================
CREATE TABLE strategic_pillars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  perspective bsc_perspective_enum NOT NULL,
  pillar_name VARCHAR(150) NOT NULL,
  description TEXT,
  strategic_weight DECIMAL(5,2) NOT NULL
    CHECK (strategic_weight > 0 AND strategic_weight <= 100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE corporate_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategic_pillar_id UUID NOT NULL
    REFERENCES strategic_pillars(id) ON DELETE RESTRICT,
  period_year INT NOT NULL,
  kpi_code VARCHAR(50) UNIQUE NOT NULL,
  kpi_name VARCHAR(255) NOT NULL,
  target_value DECIMAL(15,2) NOT NULL,
  unit_of_measure VARCHAR(50) NOT NULL,
  calculation_formula TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Perbaikan §5.1 butir 2 & 3: ada di ERD §10.1, tidak ada di DDL §10.2.
-- Mengisi level cascade yang dilewati DDL.
CREATE TABLE division_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corporate_kpi_id UUID NOT NULL REFERENCES corporate_kpis(id) ON DELETE RESTRICT,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  kpi_title VARCHAR(255) NOT NULL,
  weight_pct DECIMAL(5,2) NOT NULL CHECK (weight_pct > 0 AND weight_pct <= 100),
  target_value DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ======================== FASE 2: KINERJA ============================
CREATE TABLE appraisal_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_code VARCHAR(50) UNIQUE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status period_status_enum DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date > start_date)
);

CREATE TABLE individual_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES appraisal_periods(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  strategic_pillar_id UUID NOT NULL
    REFERENCES strategic_pillars(id) ON DELETE RESTRICT,
  -- Jalur utama cascade mengikuti ERD §10.1: Division -> Individual
  division_kpi_id UUID REFERENCES division_kpis(id) ON DELETE RESTRICT,
  kpi_title VARCHAR(255) NOT NULL,
  target_value DECIMAL(12,2) NOT NULL CHECK (target_value > 0),
  actual_value DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (actual_value >= 0),
  unit_of_measure VARCHAR(50) NOT NULL DEFAULT '%',
  kpi_weight DECIMAL(5,2) NOT NULL CHECK (kpi_weight > 0 AND kpi_weight <= 100),
  -- Generated column. Inilah alasan migrasi tidak dapat memakai drizzle-kit.
  achievement_percentage DECIMAL(6,2) GENERATED ALWAYS AS (
    CASE WHEN target_value > 0 THEN (actual_value / target_value) * 100 ELSE 0 END
  ) STORED,
  status kpi_status_enum NOT NULL DEFAULT 'DRAFT',
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (period_id, employee_id, kpi_title)
);

CREATE TABLE sop_compliance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES appraisal_periods(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  total_assigned_tasks INT NOT NULL CHECK (total_assigned_tasks >= 0),
  sla_breach_count INT NOT NULL DEFAULT 0 CHECK (sla_breach_count >= 0),
  procedure_errors INT NOT NULL DEFAULT 0 CHECK (procedure_errors >= 0),
  compliance_percentage DECIMAL(5,2) NOT NULL
    CHECK (compliance_percentage BETWEEN 0 AND 100),
  internal_audit_findings TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (period_id, employee_id)
);

-- Perbaikan §5.1 butir 2: ada di ERD §10.1, tidak ada di DDL §10.2.
CREATE TABLE competency_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES appraisal_periods(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  skill_name VARCHAR(150) NOT NULL,
  skill_category VARCHAR(20) NOT NULL CHECK (skill_category IN ('HARD','SOFT')),
  required_level INT NOT NULL CHECK (required_level BETWEEN 1 AND 5),
  actual_level INT NOT NULL CHECK (actual_level BETWEEN 1 AND 5),
  gap DECIMAL(4,2) GENERATED ALWAYS AS (required_level - actual_level) STORED,
  score DECIMAL(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE peer_reviews_360 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES appraisal_periods(id) ON DELETE CASCADE,
  evaluatee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  evaluator_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  relationship_type VARCHAR(20) NOT NULL
    CHECK (relationship_type IN ('SUPERVISOR','PEER','SUBORDINATE')),
  integrity_score DECIMAL(4,2) NOT NULL CHECK (integrity_score BETWEEN 1 AND 5),
  collaboration_score DECIMAL(4,2) NOT NULL CHECK (collaboration_score BETWEEN 1 AND 5),
  innovation_score DECIMAL(4,2) NOT NULL CHECK (innovation_score BETWEEN 1 AND 5),
  average_core_value_score DECIMAL(4,2) GENERATED ALWAYS AS (
    (integrity_score + collaboration_score + innovation_score) / 3.0
  ) STORED,
  feedback_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (period_id, evaluatee_id, evaluator_id)
);

-- Perbaikan butir 7: PRD tidak punya UNIQUE(period_id, employee_id).
CREATE TABLE performance_appraisals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES appraisal_periods(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  kpi_composite_score DECIMAL(5,2) NOT NULL CHECK (kpi_composite_score BETWEEN 0 AND 100),
  sop_compliance_score DECIMAL(5,2) NOT NULL CHECK (sop_compliance_score BETWEEN 0 AND 100),
  competency_score DECIMAL(5,2) NOT NULL CHECK (competency_score BETWEEN 0 AND 100),
  core_values_score DECIMAL(5,2) NOT NULL CHECK (core_values_score BETWEEN 0 AND 100),
  total_percentage_score DECIMAL(5,2) NOT NULL CHECK (total_percentage_score BETWEEN 0 AND 100),
  composite_gpa DECIMAL(4,2) NOT NULL CHECK (composite_gpa BETWEEN 0 AND 4),
  performance_rating VARCHAR(1) NOT NULL CHECK (performance_rating IN ('A','B','C','D')),
  potential_score DECIMAL(4,2) NOT NULL CHECK (potential_score BETWEEN 1 AND 5),
  nine_box_quadrant nine_box_quadrant_enum NOT NULL,
  is_calibrated BOOLEAN NOT NULL DEFAULT FALSE,
  calibrated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  calibrated_at TIMESTAMPTZ,
  calibration_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (period_id, employee_id)
);

-- ============ FASE 1 & 3 (dibuat sekarang, di-seed fase berikutnya) ====
CREATE TABLE manpower_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  position_id UUID NOT NULL REFERENCES job_positions(id) ON DELETE RESTRICT,
  fiscal_year INT NOT NULL,
  approved_quota INT NOT NULL CHECK (approved_quota >= 0),
  allocated_budget DECIMAL(15,2) NOT NULL CHECK (allocated_budget >= 0),
  utilized_budget DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (utilized_budget >= 0),
  hired_count INT NOT NULL DEFAULT 0 CHECK (hired_count >= 0),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (department_id, position_id, fiscal_year)
);

-- Perbaikan butir 4: direferensikan FK tapi tidak pernah didefinisikan.
CREATE TABLE hiring_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manpower_plan_id UUID NOT NULL REFERENCES manpower_plans(id) ON DELETE RESTRICT,
  requisition_code VARCHAR(50) UNIQUE NOT NULL,
  requested_date DATE NOT NULL,
  approved_date DATE,
  sla_target_days INT NOT NULL CHECK (sla_target_days > 0),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE recruitment_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_name VARCHAR(200) NOT NULL,
  applied_position_id UUID NOT NULL REFERENCES job_positions(id) ON DELETE RESTRICT,
  hiring_requisition_id UUID NOT NULL REFERENCES hiring_requisitions(id) ON DELETE RESTRICT,
  psychometric_score DECIMAL(5,2) CHECK (psychometric_score BETWEEN 0 AND 100),
  technical_test_score DECIMAL(5,2) CHECK (technical_test_score BETWEEN 0 AND 100),
  competency_interview_score DECIMAL(5,2) CHECK (competency_interview_score BETWEEN 0 AND 100),
  computed_qoh_score DECIMAL(5,2) NOT NULL CHECK (computed_qoh_score BETWEEN 0 AND 100),
  recruitment_cost DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (recruitment_cost >= 0),
  time_to_fill_days INT CHECK (time_to_fill_days >= 0),
  hiring_status VARCHAR(20) NOT NULL DEFAULT 'HIRED'
    CHECK (hiring_status IN ('APPLIED','SCREENING','INTERVIEWED','OFFERED','HIRED','REJECTED')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE onboarding_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  day_30_score DECIMAL(5,2) CHECK (day_30_score BETWEEN 0 AND 100),
  day_60_score DECIMAL(5,2) CHECK (day_60_score BETWEEN 0 AND 100),
  day_90_score DECIMAL(5,2) CHECK (day_90_score BETWEEN 0 AND 100),
  manager_notes TEXT,
  probation_passed BOOLEAN NOT NULL DEFAULT FALSE,
  conversion_date DATE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id)
);

CREATE TABLE offboarding_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reason_for_leaving VARCHAR(100) NOT NULL,
  resignation_notice_date DATE NOT NULL,
  last_working_day DATE NOT NULL,
  is_regrettable_attrition BOOLEAN NOT NULL DEFAULT FALSE,
  status offboarding_status_enum NOT NULL DEFAULT 'INITIATED',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CHECK (last_working_day >= resignation_notice_date)
);

CREATE TABLE knowledge_handovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offboarding_request_id UUID NOT NULL
    REFERENCES offboarding_requests(id) ON DELETE CASCADE,
  handover_item_name VARCHAR(255) NOT NULL,
  category VARCHAR(20) NOT NULL
    CHECK (category IN ('DOCUMENTATION','SOURCE_CODE','PHYSICAL_ASSET','ACCESS_KEY')),
  handover_to_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ
);

CREATE TABLE severance_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offboarding_request_id UUID UNIQUE NOT NULL
    REFERENCES offboarding_requests(id) ON DELETE CASCADE,
  service_years INT NOT NULL CHECK (service_years >= 0),
  base_salary DECIMAL(15,2) NOT NULL CHECK (base_salary >= 0),
  severance_pay DECIMAL(15,2) NOT NULL CHECK (severance_pay >= 0),
  service_appreciation_pay DECIMAL(15,2) NOT NULL CHECK (service_appreciation_pay >= 0),
  compensation_pay DECIMAL(15,2) NOT NULL CHECK (compensation_pay >= 0),
  dplk_topup_amount DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (dplk_topup_amount >= 0),
  total_disbursement DECIMAL(15,2) NOT NULL CHECK (total_disbursement >= 0),
  sla_disbursed_days INT CHECK (sla_disbursed_days >= 0),
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  payment_reference_no VARCHAR(100),
  paid_at TIMESTAMPTZ
);

CREATE TABLE lifetime_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  achievement_title VARCHAR(255) NOT NULL,
  achievement_type VARCHAR(20) NOT NULL
    CHECK (achievement_type IN ('PATENT','KAIZEN_SAVING','MENTORSHIP','REVENUE_IMPACT')),
  quantified_impact_idr DECIMAL(18,2) CHECK (quantified_impact_idr >= 0),
  points_awarded INT NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  date_achieved DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vmai_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES appraisal_periods(id) ON DELETE CASCADE,
  overall_vmai_score DECIMAL(5,2) NOT NULL CHECK (overall_vmai_score BETWEEN 0 AND 100),
  alignment_status VARCHAR(30) NOT NULL
    CHECK (alignment_status IN ('EXCEPTIONAL','ALIGNED','SUB_STANDARD','CRITICAL')),
  financial_pillar_score DECIMAL(5,2) NOT NULL CHECK (financial_pillar_score BETWEEN 0 AND 100),
  customer_pillar_score DECIMAL(5,2) NOT NULL CHECK (customer_pillar_score BETWEEN 0 AND 100),
  internal_pillar_score DECIMAL(5,2) NOT NULL CHECK (internal_pillar_score BETWEEN 0 AND 100),
  growth_pillar_score DECIMAL(5,2) NOT NULL CHECK (growth_pillar_score BETWEEN 0 AND 100),
  gcg_compliance_factor DECIMAL(3,2) NOT NULL DEFAULT 1.00
    CHECK (gcg_compliance_factor BETWEEN 0 AND 1),
  benchmark_deviation DECIMAL(5,2),
  generated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (period_id)
);

-- ============================ TATA KELOLA ============================
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action_type VARCHAR(30) NOT NULL
    CHECK (action_type IN ('CREATE','UPDATE','DELETE','CALIBRATE','DISBURSE',
                           'APPROVE','LOGIN','LOGOUT','UNLOCK')),
  entity_name VARCHAR(100) NOT NULL,
  record_id TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  description TEXT,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Perbaikan butir 6: PRD 6.2 menuntut anti-tamper, tapi tabelnya tabel
-- biasa. Trigger inilah yang benar-benar menegakkannya.
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'audit_logs bersifat immutable: % ditolak pada baris % (PRD 6.2)',
    TG_OP, COALESCE(OLD.id::text, '?')
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

-- Perbaikan butir 10: jalur unlock yang sah untuk koreksi, dengan
-- alasan wajib dan jejak audit.
CREATE OR REPLACE FUNCTION unlock_appraisal(
  p_appraisal_id UUID,
  p_reason TEXT,
  p_actor_user_id UUID
) RETURNS VOID AS $$
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Alasan unlock wajib diisi minimal 10 karakter'
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM set_config('eperformiq.allow_appraisal_update', 'on', true);

  UPDATE performance_appraisals
     SET is_calibrated = FALSE, calibrated_by = NULL, calibrated_at = NULL
   WHERE id = p_appraisal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appraisal % tidak ditemukan', p_appraisal_id
      USING ERRCODE = 'no_data_found';
  END IF;

  INSERT INTO audit_logs (user_id, action_type, entity_name, record_id, description)
  VALUES (p_actor_user_id, 'UNLOCK', 'performance_appraisals',
          p_appraisal_id::text, p_reason);
END;
$$ LANGUAGE plpgsql;

-- Trigger immutability nilai final (PRD 6.2). Satu-satunya jalan
-- melewatinya adalah unlock_appraisal() di atas.
CREATE OR REPLACE FUNCTION prevent_calibrated_appraisal_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_calibrated = TRUE
     AND current_setting('eperformiq.allow_appraisal_update', true)
         IS DISTINCT FROM 'on'
  THEN
    RAISE EXCEPTION
      'Nilai penilaian % telah disahkan dan bersifat immutable. Gunakan unlock_appraisal() dengan persetujuan Direktur HR (PRD 6.2).',
      OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_appraisal_immutable
  BEFORE UPDATE ON performance_appraisals
  FOR EACH ROW EXECUTE FUNCTION prevent_calibrated_appraisal_update();

-- ============================== INDEX ================================
CREATE INDEX idx_employees_manager ON employees(manager_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_department ON employees(department_id);
CREATE INDEX idx_individual_kpis_emp_period ON individual_kpis(employee_id, period_id);
CREATE INDEX idx_individual_kpis_status ON individual_kpis(status);
CREATE INDEX idx_individual_kpis_pillar ON individual_kpis(strategic_pillar_id);
CREATE INDEX idx_appraisals_period_gpa ON performance_appraisals(period_id, composite_gpa);
CREATE INDEX idx_appraisals_employee ON performance_appraisals(employee_id);
CREATE INDEX idx_audit_entity_record ON audit_logs(entity_name, record_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_division_kpis_corporate ON division_kpis(corporate_kpi_id);
CREATE INDEX idx_peer_reviews_evaluatee ON peer_reviews_360(evaluatee_id, period_id);
```

- [ ] **Step 2: Buat runner migrasi**

`src/lib/db/migrate.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const MIGRATIONS_DIR = join(process.cwd(), 'src/lib/db/migrations');

/** Menjalankan seluruh file .sql secara alfabetis. Idempoten. */
export async function runMigrations(client: PGlite): Promise<void> {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    await client.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
}

// Dijalankan langsung lewat `npm run db:migrate`
if (process.argv[1]?.includes('migrate')) {
  const client = new PGlite(process.env.PGLITE_DATA_DIR ?? '.pglite');
  runMigrations(client)
    .then(async () => {
      console.log('Migrasi selesai.');
      await client.close();
    })
    .catch(async (err) => {
      console.error('Migrasi gagal:', err);
      await client.close();
      process.exit(1);
    });
}
```

- [ ] **Step 3: Buat helper tes**

`tests/setup.ts`:

```ts
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { runMigrations } from '@/lib/db/migrate';
import type { Db } from '@/lib/db/client';

/**
 * PGlite in-memory baru per pemanggilan, tanpa dataDir, sehingga
 * setiap tes terisolasi dan tidak menyentuh .pglite/ milik dev.
 */
export async function createTestDb(): Promise<{ db: Db; client: PGlite }> {
  const client = new PGlite();
  await runMigrations(client);
  const db = drizzle(client) as unknown as Db;
  return { db, client };
}
```

- [ ] **Step 4: Tulis tes yang gagal**

`tests/integration/schema.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';

const EXPECTED_TABLES = [
  'audit_logs', 'appraisal_periods', 'companies', 'competency_scores',
  'corporate_kpis', 'departments', 'division_kpis', 'employees',
  'hiring_requisitions', 'individual_kpis', 'job_positions',
  'knowledge_handovers', 'lifetime_contributions', 'manpower_plans',
  'offboarding_requests', 'onboarding_milestones', 'peer_reviews_360',
  'performance_appraisals', 'recruitment_assessments',
  'severance_calculations', 'sop_compliance_logs', 'strategic_pillars',
  'users', 'vmai_scorecards',
];

describe('skema database', () => {
  let client: PGlite;

  beforeAll(async () => {
    ({ client } = await createTestDb());
  });

  afterAll(async () => {
    await client.close();
  });

  it('membuat tepat 24 tabel di schema public', async () => {
    const res = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name`
    );
    const names = res.rows.map((r) => r.table_name).sort();
    expect(names).toEqual(EXPECTED_TABLES);
  });

  it('membuat 7 enum', async () => {
    const res = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typtype = 'e'`
    );
    expect(Number(res.rows[0].count)).toBe(7);
  });

  it('menghitung achievement_percentage otomatis', async () => {
    // Arrange: minimal graph agar FK terpenuhi
    await client.exec(`
      INSERT INTO companies (id, company_name, legal_entity_code)
        VALUES ('11111111-1111-1111-1111-111111111111','PT Uji','UJI');
      INSERT INTO departments (id, company_id, department_name)
        VALUES ('22222222-2222-2222-2222-222222222222',
                '11111111-1111-1111-1111-111111111111','TI');
      INSERT INTO job_positions (id, department_id, position_title)
        VALUES ('33333333-3333-3333-3333-333333333333',
                '22222222-2222-2222-2222-222222222222','Engineer');
      INSERT INTO employees (id, employee_code, full_name, email,
                             department_id, position_id, base_salary, join_date)
        VALUES ('44444444-4444-4444-4444-444444444444','E-001','Uji','uji@x.id',
                '22222222-2222-2222-2222-222222222222',
                '33333333-3333-3333-3333-333333333333', 10000000, '2024-01-01');
      INSERT INTO strategic_pillars (id, company_id, perspective, pillar_name,
                                     strategic_weight)
        VALUES ('55555555-5555-5555-5555-555555555555',
                '11111111-1111-1111-1111-111111111111','FINANCIAL','Pilar Uji',25);
      INSERT INTO appraisal_periods (id, period_code, start_date, end_date)
        VALUES ('66666666-6666-6666-6666-666666666666','2026-Q3',
                '2026-07-01','2026-09-30');
    `);

    // Act
    await client.exec(`
      INSERT INTO individual_kpis (period_id, employee_id, strategic_pillar_id,
                                   kpi_title, target_value, actual_value, kpi_weight)
        VALUES ('66666666-6666-6666-6666-666666666666',
                '44444444-4444-4444-4444-444444444444',
                '55555555-5555-5555-5555-555555555555',
                'KPI Uji', 200, 185, 50);
    `);

    // Assert
    const res = await client.query<{ achievement_percentage: string }>(
      `SELECT achievement_percentage FROM individual_kpis WHERE kpi_title = 'KPI Uji'`
    );
    expect(Number(res.rows[0].achievement_percentage)).toBeCloseTo(92.5, 2);
  });

  it('menolak UPDATE pada audit_logs', async () => {
    await client.exec(`
      INSERT INTO audit_logs (action_type, entity_name, record_id, description)
        VALUES ('CREATE','uji','rec-1','uji');
    `);

    await expect(
      client.exec(`UPDATE audit_logs SET description = 'diubah' WHERE record_id = 'rec-1'`)
    ).rejects.toThrow(/immutable/i);
  });
});
```

- [ ] **Step 5: Jalankan tes untuk memastikan gagal**

```bash
npx vitest run tests/integration/schema.test.ts
```

Diharapkan: GAGAL pada `expected [...] to equal [...]` karena migrasi belum dijalankan, atau gagal dengan error `relation "companies" does not exist`. Yang penting: tes tidak lulus sebelum Step 6.

- [ ] **Step 6: Jalankan migrasi pada database dev**

```bash
npm run db:migrate
```

Diharapkan: `Migrasi selesai.` tanpa error.

- [ ] **Step 7: Jalankan tes untuk memastikan lulus**

```bash
npx vitest run tests/integration/schema.test.ts
```

Diharapkan: **4 tes LULUS**. Tes `achievement_percentage` membuktikan generated column bekerja, dan tes `audit_logs` membuktikan trigger immutability bekerja.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: skema database 24 tabel, 7 enum, trigger immutability"
```

---

### Task 3: Password Hashing (prasyarat seed)

**Files:**
- Create: `src/lib/auth/password.ts`
- Create: `tests/unit/password.test.ts`

**Interfaces:**
- Consumes: tidak ada
- Produces:
  - `hashPassword(plain: string): Promise<string>`
  - `verifyPassword(plain: string, hash: string): Promise<boolean>`

- [ ] **Step 1: Tulis tes yang gagal**

`tests/unit/password.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('password', () => {
  it('menghasilkan hash yang berbeda dari plaintext', async () => {
    const hash = await hashPassword('enterprise2026');
    expect(hash).not.toBe('enterprise2026');
    expect(hash.startsWith('$2')).toBe(true); // format bcrypt
  });

  it('menerima password yang benar', async () => {
    const hash = await hashPassword('enterprise2026');
    expect(await verifyPassword('enterprise2026', hash)).toBe(true);
  });

  it('menolak password yang salah', async () => {
    const hash = await hashPassword('enterprise2026');
    expect(await verifyPassword('salah', hash)).toBe(false);
  });

  it('menghasilkan salt berbeda untuk password sama', async () => {
    const a = await hashPassword('sama');
    const b = await hashPassword('sama');
    expect(a).not.toBe(b);
  });

  it('mengembalikan false, bukan melempar, untuk hash rusak', async () => {
    expect(await verifyPassword('apa pun', 'bukan-hash-bcrypt')).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan tes untuk memastikan gagal**

```bash
npx vitest run tests/unit/password.test.ts
```

Diharapkan: GAGAL dengan `Cannot find module '@/lib/auth/password'`.

- [ ] **Step 3: Implementasi**

`src/lib/auth/password.ts`:

```ts
import bcrypt from 'bcryptjs';

const BCRYPT_COST = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

/**
 * Mengembalikan false untuk hash yang rusak alih-alih melempar, agar
 * pemanggil tidak perlu membedakan "password salah" dari "hash korup".
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Jalankan tes untuk memastikan lulus**

```bash
npx vitest run tests/unit/password.test.ts
```

Diharapkan: **5 tes LULUS**.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: hashing password bcrypt"
```

---

### Task 4: Seed Data

**Files:**
- Create: `src/lib/db/seed/index.ts`
- Create: `tests/integration/seed.test.ts`
- Modify: `src/types/index.ts`

**Interfaces:**
- Consumes: `runMigrations` (Task 2), `hashPassword` (Task 3)
- Produces:
  - `runSeed(client: PGlite): Promise<void>`
  - `DEMO_PASSWORD = 'enterprise2026'`
  - `SEED_USER_EMAILS: ReadonlyArray<{ email, role }>`
  - ID tetap yang dipakai task berikutnya: periode `d0000000-0000-4000-8000-000000000001`, Budi `b0000000-0000-4000-8000-000000000004`, Danu `b0000000-0000-4000-8000-000000000003`, pilar 1–4 `c0000000-...-00000000000{1,2,3,4}`

- [ ] **Step 1: Sesuaikan `src/types/index.ts`**

Tiga perubahan agar tipe cocok dengan DDL (spec §5.3):

```ts
// Tambah setelah EmployeeStatus:
export type KpiStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

// Pada interface Employee: HAPUS gpa, rating, nineBoxQuadrant (turunan
// dari performance_appraisals, bukan kolom master), dan GANTI
// `department: string` menjadi:
//   departmentId: string;
//   departmentName: string;  // hasil join, bukan kolom

// Pada interface IndividualKPI, GANTI status menjadi bertipe KpiStatus.
```

- [ ] **Step 2: Tulis tes yang gagal**

`tests/integration/seed.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed, SEED_USER_EMAILS, DEMO_PASSWORD } from '@/lib/db/seed';
import { verifyPassword } from '@/lib/auth/password';

describe('seed data', () => {
  let client: PGlite;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
  });

  afterAll(async () => {
    await client.close();
  });

  it('membuat 6 user, satu per role', async () => {
    const res = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM users');
    expect(Number(res.rows[0].count)).toBe(6);
    expect(SEED_USER_EMAILS).toHaveLength(6);
  });

  it('menyimpan password sebagai hash bcrypt', async () => {
    const res = await client.query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE email = $1',
      [SEED_USER_EMAILS[0].email]
    );
    expect(res.rows[0].password_hash).not.toContain(DEMO_PASSWORD);
    expect(await verifyPassword(DEMO_PASSWORD, res.rows[0].password_hash)).toBe(true);
  });

  it('membuat 4 pilar strategis dengan total bobot 100', async () => {
    const res = await client.query<{ total: string }>(
      'SELECT sum(strategic_weight)::text AS total FROM strategic_pillars'
    );
    expect(Number(res.rows[0].total)).toBe(100);
  });

  it('membuat 4 KPI milik Budi dengan total bobot 100', async () => {
    const res = await client.query<{ total: string; count: string }>(
      'SELECT sum(kpi_weight)::text AS total, count(*)::text AS count FROM individual_kpis'
    );
    expect(Number(res.rows[0].count)).toBe(4);
    expect(Number(res.rows[0].total)).toBe(100);
  });

  it('menetapkan manager_id Budi ke Danu', async () => {
    const res = await client.query<{ manager_code: string }>(
      `SELECT m.employee_code AS manager_code FROM employees e
         JOIN employees m ON m.id = e.manager_id
        WHERE e.employee_code = 'EMP-2022-0042'`
    );
    expect(res.rows[0].manager_code).toBe('MGR-2020-0001');
  });

  it('idempoten: seed kedua tidak menggandakan baris', async () => {
    await runSeed(client);
    const res = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM users');
    expect(Number(res.rows[0].count)).toBe(6);
  });
});
```

- [ ] **Step 3: Jalankan tes untuk memastikan gagal**

```bash
npx vitest run tests/integration/seed.test.ts
```

Diharapkan: GAGAL dengan `Cannot find module '@/lib/db/seed'`.

- [ ] **Step 4: Tulis seed — bagian A (organisasi & karyawan)**

`src/lib/db/seed/index.ts`:

```ts
import type { PGlite } from '@electric-sql/pglite';
import { hashPassword } from '@/lib/auth/password';
import type { UserRole } from '@/types';

export const DEMO_PASSWORD = 'enterprise2026';
export const SEED_PERIOD_CODE = '2026-Q3';

export const SEED_USER_EMAILS: ReadonlyArray<{ email: string; role: UserRole }> = [
  { email: 'hendra.gunawan@eperformiq.co.id', role: 'BOD' },
  { email: 'siti.nurhaliza@eperformiq.co.id', role: 'HR_MANAGER' },
  { email: 'danu.tech@eperformiq.co.id', role: 'PEOPLE_MANAGER' },
  { email: 'budi.pratama@eperformiq.co.id', role: 'EMPLOYEE' },
  { email: 'bambang.audit@eperformiq.co.id', role: 'AUDITOR' },
  { email: 'admin@eperformiq.co.id', role: 'SUPER_ADMIN' },
];

/** Idempoten: seluruh INSERT memakai ON CONFLICT DO NOTHING (spec §10). */
export async function runSeed(client: PGlite): Promise<void> {
  const hash = await hashPassword(DEMO_PASSWORD);

  await client.exec(`
    INSERT INTO companies (id, company_name, legal_entity_code) VALUES
      ('a0000000-0000-4000-8000-000000000001','PT E-PerformIQ Nusantara','EPQ')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO departments (id, company_id, department_name, division_name) VALUES
      ('a0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000001','Information Technology & Engineering','Technology'),
      ('a0000000-0000-4000-8000-000000000102','a0000000-0000-4000-8000-000000000001','Human Capital & Corporate Governance','Corporate'),
      ('a0000000-0000-4000-8000-000000000103','a0000000-0000-4000-8000-000000000001','Dewan Direksi (Board of Directors)','Corporate'),
      ('a0000000-0000-4000-8000-000000000104','a0000000-0000-4000-8000-000000000001','Satuan Pengawas Internal (SPI)','Corporate')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO job_positions (id, department_id, position_title, job_grade) VALUES
      ('a0000000-0000-4000-8000-000000000201','a0000000-0000-4000-8000-000000000103','Chief Executive Officer (CEO)','1'),
      ('a0000000-0000-4000-8000-000000000202','a0000000-0000-4000-8000-000000000102','VP of Human Capital','2'),
      ('a0000000-0000-4000-8000-000000000203','a0000000-0000-4000-8000-000000000101','Head of Engineering & Ops','2'),
      ('a0000000-0000-4000-8000-000000000204','a0000000-0000-4000-8000-000000000101','Senior Software Engineer','4'),
      ('a0000000-0000-4000-8000-000000000205','a0000000-0000-4000-8000-000000000104','Chief Internal Auditor','2'),
      ('a0000000-0000-4000-8000-000000000206','a0000000-0000-4000-8000-000000000102','HR System Administrator','3')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO employees (id, employee_code, full_name, email, phone_number,
                           department_id, position_id, manager_id, status,
                           base_salary, join_date) VALUES
      ('b0000000-0000-4000-8000-000000000001','CEO-2019-0001','Ir. Hendra Gunawan, M.B.A.','hendra.gunawan@eperformiq.co.id','+62 811-0001-0001','a0000000-0000-4000-8000-000000000103','a0000000-0000-4000-8000-000000000201',NULL,'PERMANENT',95000000,'2019-01-02'),
      ('b0000000-0000-4000-8000-000000000002','HRM-2018-0002','Siti Nurhaliza, S.Psi., M.M.','siti.nurhaliza@eperformiq.co.id','+62 811-0002-0002','a0000000-0000-4000-8000-000000000102','a0000000-0000-4000-8000-000000000202','b0000000-0000-4000-8000-000000000001','PERMANENT',72000000,'2018-03-01'),
      ('b0000000-0000-4000-8000-000000000003','MGR-2020-0001','Raden Mas Danu, S.T., M.Kom.','danu.tech@eperformiq.co.id','+62 811-0003-0003','a0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000203','b0000000-0000-4000-8000-000000000001','PERMANENT',68000000,'2020-02-01'),
      ('b0000000-0000-4000-8000-000000000004','EMP-2022-0042','Budi Pratama','budi.pratama@eperformiq.co.id','+62 812-8899-1024','a0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000204','b0000000-0000-4000-8000-000000000003','PERMANENT',28500000,'2022-03-15'),
      ('b0000000-0000-4000-8000-000000000005','AUD-2017-0005','Bambang Soeprapto, Ak., CA','bambang.audit@eperformiq.co.id','+62 811-0005-0005','a0000000-0000-4000-8000-000000000104','a0000000-0000-4000-8000-000000000205','b0000000-0000-4000-8000-000000000001','PERMANENT',70000000,'2017-07-01'),
      ('b0000000-0000-4000-8000-000000000006','ADM-2023-0006','Rina Kusuma','admin@eperformiq.co.id','+62 811-0006-0006','a0000000-0000-4000-8000-000000000102','a0000000-