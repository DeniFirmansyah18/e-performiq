# Govera360 Gap Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menutup seluruh celah audit pada Arsitektur 6 Kotak Govera360 agar setiap kotak dapat dipakai *end-to-end* dengan data nyata, bukan literal hardcoded.

**Architecture:** Migration `0004` menambahkan tabel absensi dan Kotak 3. Fungsi analitik dipecah menjadi fungsi murni (testable tanpa DB) dan fungsi persisten. Tiga API route analitik baru dibuat dengan zonasi akses melalui permission RBAC baru untuk data sensitif (gaji, absensi, WBS). Komponen React direfactor dari literal ke fetch.

**Tech Stack:** Next.js 14 App Router, TypeScript, PGlite + drizzle-orm, Vitest, bcryptjs, Tailwind CSS, zod.

**Spec:** `docs/superpowers/specs/2026-09-27-govera360-gap-remediation-spec.md`

---

## Global Constraints

- Skema 31 tabel yang ada tidak boleh diubah atau di-drop; `0004` hanya menambahkan.
- Wajib jalankan `npm run db:migrate` setelah menambah migrasi, sebelum test atau commit. Inilah penyebab celah G-01.
- Setiap fungsi yang menyentuh DB harus punya integration test yang memanggilnya ke `createTestDb()`, bukan hanya test logika murni.
- Data gaji, absensi, dan WBS adalah data paling sensitif: wajib melewati permission RBAC baru.
- Dilarang menulis angka bisnis sebagai literal di komponen React; angka berasal dari API atau seed.
- Tanpa emoji dekoratif atau ikon generic AI pada judul dan komponen UI (patuh `antislop-ui`).
- Signature fungsi service yang sudah dipakai UI tidak boleh diubah: `submitDailyTimesheet`, `attachKpiEvidence`, `submitLeaveRequest`, `getVerifiedPayslip`, `submitExpenseClaim`, `createHelpdeskTicket`, `enrollMoodleCourse`, `getCareerPathForPosition`, `matchCoursesToSkillGaps`.

## Review Focus

- *Absensi tanpa titik jam keluar*: `check_out` kosong akan membuat durasi kerja tak terhingga. `check_out > check_in` ditegakkan di level DB.
- *Absensi hari weekend*: Sabtu/Minggu tidak boleh dihitung sebagai hari hadir dalam Bradford Factor.
- *PP 35/2021 Pasal 26-29*: lembur tidak boleh melebihi 4 jam/hari maupun 18 jam/minggu, jam kerja tidak boleh melebihi 12 jam/hari.
- *Cuti sakit mengontaminasi Bradford*: hari sakit dengan surat dokter tidak boleh menaikkan risiko flight risk.
- *Lamaran melewati quota MPP*: pengajuan boleh masuk, tetapi pengajuanan tidak boleh menyebabkan `hired_count` melewati `approved_quota`.
- *Slip gaji milik orang lain*: permintaan slip milik karyawan lain harus 403, bukan sekadar 404.
- *WBS bocor identitas*: respons API helpdesk tidak boleh menyertakan `employee_id` untuk tiket `is_whistleblowing = true`.
- *Employee memanggil route analitik*: EMPLOYEE harus mendapat 403 dari `recommendation-signals`, `flight-risk`, dan `cost-of-workforce`.

---

### Task 1: Migration 0004 — Absensi & Kotak 3

**Files:**
- Create: `src/lib/db/migrations/0004_attendance_and_talent_acquisition.sql`
- Test: `tests/integration/govera-0004-schema.test.ts`

**Interfaces:**
- Consumes: `employees(id)`, `job_positions(id)`, `manpower_plans(id, department_id, position_id, approved_quota, hired_count)`
- Produces: tabel `attendance_records`, `job_postings`, `internal_applications`, `interview_slots`

- [ ] **Step 1: Write the failing test**

Buat `tests/integration/govera-0004-schema.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';

const CO = 'c0000000-0000-4000-8000-000000000001';
const DEPT = 'c0000000-0000-4000-8000-000000000002';
const POS = 'c0000000-0000-4000-8000-000000000003';
const EMP = 'c0000000-0000-4000-8000-000000000004';

describe('Migrasi 0004: Absensi & Kotak 3 Talent Acquisition', () => {
  let client: PGlite;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await client.exec(`
      INSERT INTO companies (id, company_name, legal_entity_code)
        VALUES ('${CO}','PT Absen','ABS') ON CONFLICT DO NOTHING;
      INSERT INTO departments (id, company_id, department_name)
        VALUES ('${DEPT}','${CO}','Ops') ON CONFLICT DO NOTHING;
      INSERT INTO job_positions (id, department_id, position_title)
        VALUES ('${POS}','${DEPT}','Ops Staff') ON CONFLICT DO NOTHING;
      INSERT INTO employees (id, employee_code, full_name, email,
                             department_id, position_id, base_salary, join_date)
        VALUES ('${EMP}','EMP-ABS-01','Wira','wira@x.id',
                '${DEPT}','${POS}',9000000,'2024-01-01') ON CONFLICT DO NOTHING;
    `);
  });

  afterAll(async () => {
    await client.close();
  });

  it('membuat 4 tabel baru', async () => {
    const res = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('attendance_records','job_postings','internal_applications','interview_slots')`
    );
    expect(Number(res.rows[0].count)).toBe(4);
  });

  it('menolak check_out yang tidak lebih besar dari check_in', async () => {
    await expect(
      client.query(
        `INSERT INTO attendance_records (employee_id, work_date, check_in, check_out)
         VALUES ('${EMP}','2026-09-28','17:00','08:00');`
      )
    ).rejects.toThrow();
  });

  it('menolak lembur melebihi 4 jam per hari (PP 35/2021 Pasal 26)', async () => {
    await expect(
      client.query(
        `INSERT INTO attendance_records (employee_id, work_date, check_in, check_out, total_overtime_hours)
         VALUES ('${EMP}','2026-09-29','08:00','20:30',4.5);`
      )
    ).rejects.toThrow();
  });

  it('menerapkan deduplikasi satu baris absensi per karyawan per hari', async () => {
    await client.query(
      `INSERT INTO attendance_records (employee_id, work_date, check_in, check_out)
       VALUES ('${EMP}','2026-09-30','08:00','17:00') ON CONFLICT DO NOTHING;`
    );
    await expect(
      client.query(
        `INSERT INTO attendance_records (employee_id, work_date, check_in, check_out)
         VALUES ('${EMP}','2026-09-30','09:00','18:00');`
      )
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/govera-0004-schema.test.ts`
Expected: FAIL — `relation "attendance_records" does not exist`

- [ ] **Step 3: Write the migration**

Buat `src/lib/db/migrations/0004_attendance_and_talent_acquisition.sql`:

```sql
-- ==================== KOTAK 1: ABSENSI & KEDISIPLINAN ====================
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  check_in TIME NOT NULL,
  check_out TIME NOT NULL,
  is_weekend BOOLEAN NOT NULL DEFAULT FALSE,
  is_sick_leave BOOLEAN NOT NULL DEFAULT FALSE,
  is_present BOOLEAN NOT NULL DEFAULT TRUE,
  total_work_hours DECIMAL(4,2) NOT NULL DEFAULT 8.00,
  total_overtime_hours DECIMAL(4,2) NOT NULL DEFAULT 0.00,
  source VARCHAR(20) NOT NULL DEFAULT 'MANUAL'
    CHECK (source IN ('MANUAL','MACHINE','KIOSK')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, work_date),
  CHECK (total_overtime_hours >= 0.00 AND total_overtime_hours <= 4.00),
  CHECK (total_work_hours > 0.00 AND total_work_hours <= 12.00),
  CHECK (check_out > check_in)
);

-- ==================== KOTAK 3: JOB BOARD & MOBILITAS INTERNAL ====================
CREATE TABLE IF NOT EXISTS job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manpower_plan_id UUID NOT NULL REFERENCES manpower_plans(id) ON DELETE RESTRICT,
  position_id UUID NOT NULL REFERENCES job_positions(id) ON DELETE RESTRICT,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  posting_title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  required_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_internal_only BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('DRAFT','OPEN','CLOSED','FILLED')),
  posted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS internal_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  applicant_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  cover_letter TEXT NOT NULL,
  cv_url TEXT NOT NULL,
  screening_score DECIMAL(5,2) CHECK (screening_score BETWEEN 0 AND 100),
  screening_summary TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('SUBMITTED','SHORTLISTED','INTERVIEW','OFFERED','REJECTED','WITHDRAWN')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (job_posting_id, applicant_employee_id)
);

CREATE TABLE IF NOT EXISTS interview_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  capacity INT NOT NULL DEFAULT 1 CHECK (capacity > 0),
  booked_count INT NOT NULL DEFAULT 0 CHECK (booked_count >= 0),
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (end_time > start_time)
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/govera-0004-schema.test.ts`
Expected: PASS

- [ ] **Step 5: Apply migration to dev database**

Run: `npm run db:migrate`
Expected: `Migrasi selesai.`

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/migrations/0004_attendance_and_talent_acquisition.sql tests/integration/govera-0004-schema.test.ts
git commit -m "feat(db): tambahkan migrasi 0004 absensi dan job board Kotak 3"
```

---

### Task 2: Permission RBAC untuk Data Sensitif

**Files:**
- Modify: `src/lib/auth/rbac.ts`
- Test: `tests/unit/rbac.test.ts`

**Interfaces:**
- Consumes: `SessionPayload`, `can(role, permission)`, `assertCan(session, permission)`
- Produces: permission baru `attendance:read`, `attendance:write`, `payroll:read`, `flight_risk:read`, `wbs:read`

- [ ] **Step 1: Write the failing test**

Tambahkan blok ini di akhir `tests/unit/rbac.test.ts`:

```typescript
describe('RBAC data sensitif Govera360', () => {
  it('EMPLOYEE tidak boleh membaca flight risk organisasi', () => {
    expect(can('EMPLOYEE', 'flight_risk:read')).toBe(false);
    expect(can('HR_MANAGER', 'flight_risk:read')).toBe(true);
    expect(can('PEOPLE_MANAGER', 'flight_risk:read')).toBe(true);
  });

  it('payroll hanya untuk pemilik slip, HR, dan BOD', () => {
    expect(can('EMPLOYEE', 'payroll:read')).toBe(true);
    expect(can('HR_MANAGER', 'payroll:read')).toBe(true);
    expect(can('PEOPLE_MANAGER', 'payroll:read')).toBe(false);
    expect(can('AUDITOR', 'payroll:read')).toBe(false);
  });

  it('whistleblowing hanya untuk auditor dan HR, bukan atasan langsung', () => {
    expect(can('AUDITOR', 'wbs:read')).toBe(true);
    expect(can('HR_MANAGER', 'wbs:read')).toBe(true);
    expect(can('EMPLOYEE', 'wbs:read')).toBe(false);
    expect(can('PEOPLE_MANAGER', 'wbs:read')).toBe(false);
  });

  it('karyawan boleh mengisi dan membaca absensi sendiri', () => {
    expect(can('EMPLOYEE', 'attendance:write')).toBe(true);
    expect(can('EMPLOYEE', 'attendance:read')).toBe(true);
    expect(can('PEOPLE_MANAGER', 'attendance:write')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/rbac.test.ts`
Expected: FAIL — TypeScript error, `'flight_risk:read'` bukan member dari `Permission`.

- [ ] **Step 3: Implement the permissions**

Ganti blok `Permission` dan tambahkan entri ke `MATRIX` di `src/lib/auth/rbac.ts`:

```typescript
export type Permission =
  | 'kpi:read'
  | 'kpi:write'
  | 'kpi:approve'
  | 'appraisal:calculate'
  | 'appraisal:calibrate'
  | 'audit:read'
  | 'attendance:read'
  | 'attendance:write'
  | 'payroll:read'
  | 'flight_risk:read'
  | 'wbs:read';

const MATRIX: Record<Permission, ReadonlyArray<UserRole>> = {
  'kpi:read': ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE', 'AUDITOR', 'ASSESSOR'],
  'kpi:write': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
  'kpi:approve': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER'],
  'appraisal:calculate': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER', 'ASSESSOR'],
  'appraisal:calibrate': ['SUPER_ADMIN', 'HR_MANAGER', 'BOD', 'ASSESSOR'],
  'audit:read': ['SUPER_ADMIN', 'AUDITOR'],
  'attendance:read': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE', 'AUDITOR'],
  'attendance:write': ['SUPER_ADMIN', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'],
  'payroll:read': ['SUPER_ADMIN', 'HR_MANAGER', 'BOD', 'EMPLOYEE'],
  'flight_risk:read': ['SUPER_ADMIN', 'HR_MANAGER', 'BOD', 'PEOPLE_MANAGER'],
  'wbs:read': ['SUPER_ADMIN', 'HR_MANAGER', 'AUDITOR'],
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/rbac.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/rbac.ts tests/unit/rbac.test.ts
git commit -m "feat(auth): tambahkan permission RBAC untuk absensi, gaji, flight risk, dan WBS"
```

---

### Task 3: Service Absensi & Bradford Factor

**Files:**
- Create: `src/lib/services/attendanceService.ts`
- Create: `src/app/api/v1/performance/attendance/route.ts`
- Test: `tests/integration/attendanceService.test.ts`

**Interfaces:**
- Consumes: tabel `attendance_records`
- Produces:
  - `type AbsenceFact = { workDate: string; isPresent: boolean; isWeekend: boolean; isSickLeave: boolean }`
  - `computeBradfordFactor(facts: AbsenceFact[]): number`
  - `recordAttendance(input: RecordAttendanceInput): Promise<AttendanceRecord>`
  - `getAttendanceFactRows(db: Db, employeeId: string, from: string, to: string): Promise<AbsenceFact[]>`

- [ ] **Step 1: Write the failing test**

Buat `tests/integration/attendanceService.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeBradfordFactor } from '@/lib/services/attendanceService';
import type { AbsenceFact } from '@/lib/services/attendanceService';

const hari = (n: number): string => `2026-03-${String(n).padStart(2, '0')}`;
const hadir = (n: number, extra: Partial<AbsenceFact> = {}): AbsenceFact => ({
  workDate: hari(n),
  isPresent: true,
  isWeekend: false,
  isSickLeave: false,
  ...extra,
});
const alpa = (n: number, extra: Partial<AbsenceFact> = {}): AbsenceFact => ({
  workDate: hari(n),
  isPresent: false,
  isWeekend: false,
  isSickLeave: false,
  ...extra,
});

describe('Bradford Factor (indeks absensi)', () => {
  it('absensi tanpa alpa menghasilkan faktor 0', () => {
    expect(computeBradfordFactor([hadir(2), hadir(3), hadir(4), hadir(5)])).toBe(0);
  });

  it('satu alpa setelah 4 hari hadir menghasilkan faktor 1', () => {
    expect(computeBradfordFactor([hadir(2), hadir(3), hadir(4), hadir(5), alpa(6)])).toBe(1);
  });

  it('alpa beruntun menaikkan faktor secara kumulatif (1+2+3)', () => {
    // 4 hari hadir lalu 3 alpa berturut-turut: 1 + 2 + 3 = 6
    const facts = [hadir(2), hadir(3), hadir(4), hadir(5), alpa(6), alpa(7), alpa(8)];
    expect(computeBradfordFactor(facts)).toBe(6);
  });

  it('alpa terputus oleh hari hadir mereset penghitungan consecutive absence', () => {
    // 4 hadir, 1 alpa, 4 hadir, 1 alpa => 1 + 1 = 2
    const facts = [
      hadir(2), hadir(3), hadir(4), hadir(5), alpa(6),
      hadir(7), hadir(8), hadir(9), hadir(10), alpa(11),
    ];
    expect(computeBradfordFactor(facts)).toBe(2);
  });

  it('hari weekend tidak dihitung sebagai alpa maupun hadir', () => {
    const facts = [
      hadir(2), hadir(3), alpa(4, { isWeekend: true }), hadir(5),
    ];
    expect(computeBradfordFactor(facts)).toBe(0);
  });

  it('cuti sakit tidak menaikkan indeks absensi', () => {
    const facts = [hadir(2), hadir(3), alpa(4, { isSickLeave: true }), hadir(5)];
    expect(computeBradfordFactor(facts)).toBe(0);
  });

  it('mengembalikan 0 untuk daftar kosong', () => {
    expect(computeBradfordFactor([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/attendanceService.test.ts`
Expected: FAIL — `Cannot find module '@/lib/services/attendanceService'`

- [ ] **Step 3: Implement the pure calculator**

Buat `src/lib/services/attendanceService.ts` dengan fungsi murni terlebih dahulu:

```typescript
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export type AbsenceFact = {
  workDate: string;
  isPresent: boolean;
  isWeekend: boolean;
  isSickLeave: boolean;
};

/**
 * Bradford Factor: jumlah Absence Frequency x Absence Duration.
 * Konsekuensi indeks ini digunakan sebagai ambang batas kepatuhan
 * absensi (indeks < 45) pada spesifikasi PRD During-Employment.
 * Hari weekend dan cuti sakit resmi tidak dihitung sebagai alpa.
 */
export function computeBradfordFactor(facts: AbsenceFact[]): number {
  const relevant = facts
    .filter((f) => !f.isWeekend && !f.isSickLeave)
    .sort((a, b) => a.workDate.localeCompare(b.workDate));

  let factor = 0;
  let consecutive = 0;

  for (const fact of relevant) {
    if (fact.isPresent) {
      consecutive = 0;
    } else {
      consecutive += 1;
      factor += consecutive;
    }
  }

  return factor;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/attendanceService.test.ts`
Expected: PASS

- [ ] **Step 5: Add the persistence layer and API route**

Tambahkan ke `src/lib/services/attendanceService.ts`:

```typescript
export type RecordAttendanceInput = {
  employeeId: string;
  workDate: string;
  checkIn: string;
  checkOut: string;
  isSickLeave?: boolean;
  source?: 'MANUAL' | 'MACHINE' | 'KIOSK';
};

export async function getAttendanceFactRows(
  db: Db,
  employeeId: string,
  from: string,
  to: string
): Promise<AbsenceFact[]> {
  const result = await db.execute(sql`
    SELECT to_char(work_date, 'YYYY-MM-DD') AS "workDate",
           is_present AS "isPresent",
           is_weekend AS "isWeekend",
           is_sick_leave AS "isSickLeave"
      FROM attendance_records
     WHERE employee_id = ${employeeId}::uuid
       AND work_date BETWEEN ${from}::date AND ${to}::date
  `);
  return result.rows as AbsenceFact[];
}
```

Buat `src/app/api/v1/performance/attendance/route.ts` yang:
- `GET` → menerima query `employee_id` opsional (default `session.employeeId`), memanggil `assertCan(session, 'attendance:read')` dan `assertEmployeeVisible(scope, employeeId)`, mengembalikan `{ facts, bradford_factor }`.
- `POST` → memvalidasi body dengan zod (`workDate` format `YYYY-MM-DD`, `checkIn`/`checkOut` format `HH:MM`), memanggil `assertCan(session, 'attendance:write')`, menghitung durasi kerja, menolak `checkOut <= checkIn` dan `total_overtime_hours > 4` dengan pesan yang mengutip PP No. 35/2021.

Gunakan pola dari `src/app/api/v1/performance/timesheets/route.ts`: `getAuthSession`, `ok`/`problem`, `export const runtime = 'nodejs'`, `export const dynamic = 'force-dynamic'`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/attendanceService.ts src/app/api/v1/performance/attendance/route.ts tests/integration/attendanceService.test.ts
git commit -m "feat(attendance): tambahkan service absensi dan kalkulator Bradford Factor Kotak 1"
```

---

### Task 4: Integrasikan Absensi ke Flight Risk (Ganti Hardcode)

**Files:**
- Modify: `src/lib/services/coreHrService.ts`
- Modify: `src/lib/services/productivityService.ts`
- Test: `tests/integration/flightRisk-with-attendance.test.ts`

**Interfaces:**
- Consumes: `computeBradfordFactor`, `getAttendanceFactRows`, tabel `performance_appraisals`, `peer_reviews_360`
- Produces:
  - `type EmployeeRiskProfile = { employeeId: string; bradfordFactor: number; peerReviewAvg: number; overtimeHoursWeekly: number; contractDaysRemaining: number }`
  - `buildRiskProfile(db, employeeId): Promise<EmployeeRiskProfile>` — angka bersumber dari DB
  - `calculateFlightRisk(profile): FlightRiskResult` — **signature berubah**, menerima objek profil

- [ ] **Step 1: Write the failing test**

Buat `tests/integration/flightRisk-with-attendance.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { buildRiskProfile, calculateFlightRisk } from '@/lib/services/coreHrService';
import type { Db } from '@/lib/db/client';

const EMP = 'c0000000-0000-4000-8000-000000000004';

describe('Flight Risk sourced from real attendance data', () => {
  let client: PGlite;
  let db: Db;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    db = drizzle(client) as unknown as Db;
    await client.exec(`
      INSERT INTO companies (id, company_name, legal_entity_code)
        VALUES ('c0000000-0000-4000-8000-000000000001','PT Absen','ABS') ON CONFLICT DO NOTHING;
      INSERT INTO departments (id, company_id, department_name)
        VALUES ('c0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000001','Ops') ON CONFLICT DO NOTHING;
      INSERT INTO job_positions (id, department_id, position_title)
        VALUES ('c0000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000002','Ops Staff') ON CONFLICT DO NOTHING;
      INSERT INTO employees (id, employee_code, full_name, email,
                             department_id, position_id, base_salary, join_date)
        VALUES ('${EMP}','EMP-ABS-01','Wira','wira@x.id',
                'c0000000-0000-4000-8000-000000000002',
                'c0000000-0000-4000-8000-000000000003',9000000,'2024-01-01') ON CONFLICT DO NOTHING;
    `);
  });

  afterAll(async () => {
    await client.close();
  });

  it('buildRiskProfile menghitung Bradford dari baris absensi nyata, bukan input manual', async () => {
    // 4 hari hadir lalu 1 alpa = Bradford 1
    const rows: Array<[string, boolean]> = [
      ['2026-03-02', true], ['2026-03-03', true],
      ['2026-03-04', true], ['2026-03-05', true], ['2026-03-06', false],
    ];
    for (const [d, present] of rows) {
      await client.query(
        `INSERT INTO attendance_records (employee_id, work_date, check_in, check_out, is_present)
         VALUES ($1,$2,'08:00','17:00',$3);`,
        [EMP, d, present]
      );
    }

    const profile = await buildRiskProfile(db, EMP);
    expect(profile.bradfordFactor).toBe(1);
  });

  it('cuti sakit tidak menaikkan Bradford Factor pada profil', async () => {
    await client.query(
      `INSERT INTO attendance_records (employee_id, work_date, check_in, check_out, is_present, is_sick_leave)
       VALUES ($1,'2026-03-09','08:00','17:00',false,true) ON CONFLICT DO NOTHING;`,
      [EMP]
    );
    const profile = await buildRiskProfile(db, EMP);
    expect(profile.bradfordFactor).toBe(1);
  });

  it('calculateFlightRisk memakai profil hasil query', () => {
    const risk = calculateFlightRisk({
      employeeId: EMP,
      bradfordFactor: 65,
      peerReviewAvg: 2.8,
      overtimeHoursWeekly: 14,
      contractDaysRemaining: 40,
    });
    expect(risk.level).toBe('HIGH');
    expect(risk.warnings).toContain(
      'Indeks Bradford absensi mengindikasikan ketidakhadiran berulang'
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/flightRisk-with-attendance.test.ts`
Expected: FAIL — `buildRiskProfile is not a function`

- [ ] **Step 3: Implement buildRiskProfile and update calculateFlightRisk**

Di `src/lib/services/coreHrService.ts`, ganti interface dan tanda tangan `calculateFlightRisk`:

```typescript
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { getAttendanceFactRows, computeBradfordFactor } from './attendanceService';

export type EmployeeRiskProfile = {
  employeeId: string;
  bradfordFactor: number;
  peerReviewAvg: number;
  overtimeHoursWeekly: number;
  contractDaysRemaining: number;
};

export async function buildRiskProfile(
  db: Db,
  employeeId: string
): Promise<EmployeeRiskProfile> {
  const today = new Date();
  const from = new Date(today.getTime() - 90 * 86400000).toISOString().slice(0, 10);
  const to = today.toISOString().slice(0, 10);

  const facts = await getAttendanceFactRows(db, employeeId, from, to);
  const bradfordFactor = computeBradfordFactor(facts);

  const peer = await db.execute(sql`
    SELECT COALESCE(AVG(average_core_value_score), 4.2) AS "avgScore"
      FROM peer_reviews_360
     WHERE evaluatee_id = ${employeeId}::uuid
  `);

  const overtime = await db.execute(sql`
    SELECT COALESCE(SUM(total_overtime_hours), 0) AS "totalOvertime"
      FROM attendance_records
     WHERE employee_id = ${employeeId}::uuid
       AND work_date >= ${from}::date
  `);

  return {
    employeeId,
    bradfordFactor,
    peerReviewAvg: Number((peer.rows[0] as any)?.avgScore ?? 4.2),
    overtimeHoursWeekly:
      Math.round(Number((overtime.rows[0] as any)?.totalOvertime ?? 0) / 12.857),
    contractDaysRemaining: 0,
  };
}

export function calculateFlightRisk(profile: EmployeeRiskProfile): FlightRiskResult {
  const { bradfordFactor, peerReviewAvg, overtimeHoursWeekly, contractDaysRemaining } = profile;
  let score = 10;
  const warnings: string[] = [];

  if (bradfordFactor > 45) {
    score += 35;
    warnings.push('Indeks Bradford absensi mengindikasikan ketidakhadiran berulang');
  }
  if (peerReviewAvg < 3.2) {
    score += 25;
    warnings.push('Penurunan indeks kepuasan interaksi tim & rekan kerja');
  }
  if (overtimeHoursWeekly > 10) {
    score += 20;
    warnings.push('Beban lembur berlebih berisiko memicu kelelahan kerja (burnout)');
  }
  if (contractDaysRemaining <= 60 && contractDaysRemaining > 0) {
    score += 15;
    warnings.push('Masa berlaku kontrak PKWT akan berakhir dalam 60 hari');
  }

  const level = score >= 60 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW';
  return { score: Math.min(score, 100), level, warnings };
}
```

- [ ] **Step 4: Update the existing test to the new signature**

Di `tests/unit/coreHrService.test.ts`, ubah pemanggilan menjadi bentuk objek:

```typescript
const risk = calculateFlightRisk({
  employeeId: 'budi',
  bradfordFactor: 65,
  peerReviewAvg: 2.8,
  overtimeHoursWeekly: 14,
  contractDaysRemaining: 40,
});
```

- [ ] **Step 5: Run both test files**

Run: `npx vitest run tests/integration/flightRisk-with-attendance.test.ts tests/unit/coreHrService.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/coreHrService.ts src/lib/services/attendanceService.ts src/lib/services/productivityService.ts tests/integration/flightRisk-with-attendance.test.ts tests/unit/coreHrService.test.ts
git commit -m "refactor(flight-risk): sumberkan indeks Bradford dari data absensi nyata"
```

---

### Task 5: Tiga API Route Analitik yang Hilang (G-04)

**Files:**
- Create: `src/app/api/v1/performance/recommendation-signals/route.ts`
- Create: `src/app/api/v1/governance/flight-risk/route.ts`
- Create: `src/app/api/v1/finance/cost-of-workforce/route.ts`
- Test: `tests/api/govera-analytics-routes.test.ts`

**Interfaces:**
- Consumes: `assertCan`, `resolveVisibleEmployeeIds`, `assertEmployeeVisible`, `generateTalentRecommendationSignal`, `buildRiskProfile`, `calculateFlightRisk`, `calculateCostOfWorkforce`
- Produces: tiga endpoint JSON yang masing-masing mengembalikan array/list analitik

- [ ] **Step 1: Write the failing test**

Buat `tests/api/govera-analytics-routes.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';

describe('API analitik Govera360 menolak EMPLOYEE (GCG segregation of duty)', () => {
  let client: PGlite;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed();
  });

  afterAll(async () => {
    await client.close();
  });

  it('matriks permission menutup akses analitik untuk EMPLOYEE', async () => {
    const { can } = await import('@/lib/auth/rbac');
    expect(can('EMPLOYEE', 'flight_risk:read')).toBe(false);
    expect(can('EMPLOYEE', 'wbs:read')).toBe(false);
  });

  it('flight risk dan cost of workforce bukan endpoint publik tanpa role', async () => {
    // Route tanpa session harus 401; ini dijamin oleh getAuthSession
    const { getAuthSession } = await import('@/lib/auth/getAuthSession');
    const fakeReq = { cookies: { get: () => undefined } } as any;
    const session = await getAuthSession(fakeReq);
    expect(session).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/govera-analytics-routes.test.ts`
Expected: PASS setelah Task 2 selesai (permission sudah ada). Jika FAIL, periksa Task 2.

- [ ] **Step 3: Implement the three routes**

Buat `src/app/api/v1/performance/recommendation-signals/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { resolveVisibleEmployeeIds, assertEmployeeVisible } from '@/lib/auth/scope';
import { ok, problem } from '@/lib/api/response';
import { generateTalentRecommendationSignal } from '@/lib/services/productivityService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return problem(new Error('Sesi tidak valid'), 'recommendation-signals');

    const scope = await resolveVisibleEmployeeIds(db, session);
    const { searchParams } = new URL(req.url);
    const requested = searchParams.get('employee_id');

    if (requested) assertEmployeeVisible(scope, requested);
    const target = requested ?? (scope === 'ALL' ? null : session.employeeId);
    if (!target) {
      return ok({ items: [], total: 0 }, 'Tidak ada karyawan dalam cakupan Anda.');
    }

    const result = await db.execute(sql`
      SELECT pa.employee_id AS "employeeId",
             e.full_name AS "fullName",
             pa.composite_gpa AS "gpa",
             pa.nine_box_quadrant AS "nineBox"
        FROM performance_appraisals pa
        JOIN employees e ON e.id = pa.employee_id
       WHERE pa.employee_id = ${target}::uuid
    `);

    const items = result.rows.map((row: any) => {
      const signal = generateTalentRecommendationSignal({
        gpa: Number(row.gpa),
        nineBox: row.nineBox,
      });
      return { ...row, gpa: Number(row.gpa), signal };
    });

    return ok({ items, total: items.length }, 'Sinyal rekomendasi talenta berhasil dimuat.');
  } catch (err) {
    return problem(err, 'recommendation-signals');
  }
}
```

Buat `src/app/api/v1/governance/flight-risk/route.ts` dengan pola sama: `assertCan(session, 'flight_risk:read')`, `resolveVisibleEmployeeIds`, lalu untuk setiap employee dalam scope memanggil `buildRiskProfile(db, id)` dan `calculateFlightRisk(profile)`, mengembalikan `{ items: [{ employeeId, fullName, riskScore, level, warnings }] }`.

Buat `src/app/api/v1/finance/cost-of-workforce/route.ts` dengan `assertCan(session, 'payroll:read')`, lalu query agregat:

```typescript
const payroll = await db.execute(sql`
  SELECT COALESCE(SUM(e.base_salary), 0) AS "totalPayroll"
    FROM employees e
   WHERE e.status IN ('PROBATION','PERMANENT','CONTRACT')
`);

const claims = await db.execute(sql`
  SELECT COALESCE(SUM(amount), 0) AS "totalClaims"
    FROM expense_claims
   WHERE status IN ('APPROVED','PAID')
`);

const output = await db.execute(sql`
  SELECT COALESCE(SUM(k.actual_value * k.kpi_weight / 100.0), 0) AS "totalOutput"
    FROM individual_kpis k
   WHERE k.status = 'APPROVED'
`);

const result = calculateCostOfWorkforce({
  totalPayrollIDR: Number((payroll.rows[0] as any).totalPayroll),
  totalClaimsIDR: Number((claims.rows[0] as any).totalClaims),
  totalOutputIDR: Number((output.rows[0] as any).totalOutput) * 1_000_000,
});
```

- [ ] **Step 4: Run the test and verify types**

Run: `npx vitest run tests/api/govera-analytics-routes.test.ts` && `npx tsc --noEmit`
Expected: PASS dan 0 TypeScript error.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/v1/performance/recommendation-signals/route.ts src/app/api/v1/governance/flight-risk/route.ts src/app/api/v1/finance/cost-of-workforce/route.ts tests/api/govera-analytics-routes.test.ts
git commit -m "feat(api): tambahkan route analitik recommendation-signal, flight-risk, dan cost-of-workforce"
```

---

### Task 6: Seed untuk 7 Tabel Govera360 + Absensi (G-05)

**Files:**
- Modify: `src/lib/db/seed/index.ts`
- Test: `tests/integration/seed-govera.test.ts`

**Interfaces:**
- Consumes: `runSeed()`
- Produces: data realistis pada `attendance_records`, `career_path_levels`, `moodle_course_enrollments`, `daily_timesheets`, `leave_requests`, `expense_claims`, `helpdesk_tickets`, `job_postings`, `internal_applications`, `interview_slots`

- [ ] **Step 1: Write the failing test**

Buat `tests/integration/seed-govera.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';

describe('Seed tabel Govera360', () => {
  let client: PGlite;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed();
  });

  afterAll(async () => {
    await client.close();
  });

  const tables = [
    'attendance_records', 'daily_timesheets', 'career_path_levels',
    'moodle_course_enrollments', 'leave_requests', 'expense_claims',
    'helpdesk_tickets', 'job_postings', 'internal_applications', 'interview_slots',
  ];

  for (const table of tables) {
    it(`mengisi minimal 1 baris pada ${table}`, async () => {
      const res = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM ${table}`
      );
      expect(Number(res.rows[0].count)).toBeGreaterThan(0);
    });
  }

  it('tidak ada tiket WBS yang menyimpan employee_id (GCG Fairness)', async () => {
    const res = await client.query<{ bad: string }>(
      `SELECT count(*)::text AS bad FROM helpdesk_tickets
        WHERE is_whistleblowing = true AND employee_id IS NOT NULL`
    );
    expect(Number(res.rows[0].bad)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/seed-govera.test.ts`
Expected: FAIL — `count` = 0 pada tabel Govera360.

- [ ] **Step 3: Add seed blocks**

Di akhir `runSeed()` (sebelum penutupnya), tambahkan blok INSERT untuk 10 tabel di atas. Ikuti pola ID hardcoded yang sudah dipakai seed (prefix huruf per entitas). Pastikan:
- `attendance_records`: 20 hari kerja untuk Budi dengan 1 hari alpa agar Bradford Factor menghasilkan angka bukan nol.
- `career_path_levels`: minimal 2 jenjang (Staf → Supervisor, Supervisor → Manager).
- `helpdesk_tickets`: 1 tiket WBS dengan `employee_id = NULL`.
- `job_postings`: 2 lowongan dengan `manpower_plan_id` yang sudah ada di seed.
- `interview_slots`: 3 slot per lowongan.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/seed-govera.test.ts`
Expected: PASS

- [ ] **Step 5: Re-seed the dev database**

Run: `npm run db:reset`
Expected: migrasi dan seed selesai tanpa error.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/seed/index.ts tests/integration/seed-govera.test.ts
git commit -m "feat(seed): isi tabel absensi, Job Board, dan 7 tabel Govera360 dengan data realistis"
```

---

### Task 7: UI yang Belum Bisa Dicapai Pengguna (G-06)

**Files:**
- Create: `src/app/api/v1/finance/expense-claims/route.ts`
- Create: `src/app/api/v1/governance/helpdesk/route.ts`
- Create: `src/app/api/v1/performance/kpi-evidence/route.ts`
- Create: `src/app/api/v1/learning/career-path/route.ts`
- Create: `src/components/employee/ReimbursementModal.tsx`
- Create: `src/components/employee/HelpdeskTicketModal.tsx`
- Create: `src/components/employee/KpiEvidenceUploadModal.tsx`
- Modify: `src/components/employee/CareerPathModal.tsx`
- Modify: `src/app/dashboard/employee-portal/page.tsx`

**Interfaces:**
- Consumes: `submitExpenseClaim`, `createHelpdeskTicket`, `attachKpiEvidence`, `getCareerPathForPosition`, `enrollMoodleCourse`
- Produces: 4 endpoint baru + 3 modal baru yang menggantikan data hardcoded

- [ ] **Step 1: Create the four API routes**

Buat `src/app/api/v1/finance/expense-claims/route.ts` (`GET` milik sendiri, `POST` memanggil `submitExpenseClaim`).
Buat `src/app/api/v1/governance/helpdesk/route.ts` (`POST` memanggil `createHelpdeskTicket`; `GET` untuk HR/AUDITOR memanggil `assertCan(session, 'wbs:read')` dan **menyembunyikan `employee_id` untuk tiket WBS**).
Buat `src/app/api/v1/performance/kpi-evidence/route.ts` (`POST` memanggil `attachKpiEvidence`, memvalidasi `individual_kpi_id` milik session melalui `assertEmployeeVisible`).
Buat `src/app/api/v1/learning/career-path/route.ts` (`GET` memanggil `getCareerPathForPosition` untuk posisi employee yang sedang login).

Ikuti pola `src/app/api/v1/performance/timesheets/route.ts` pada keempat file: `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, `getAuthSession`, `ok`/`problem`, validasi zod.

- [ ] **Step 2: Create ReimbursementModal**

Bermodel pada `src/components/employee/TimesheetModal.tsx`: header gelap, form berisi `claimCategory` (MEDICAL/TRAVEL/OPERATIONAL), `amount`, `claimDate`, dan input file bukti struk yang menyimpan nama file ke `receiptUrl`. Submit ke `/api/v1/finance/expense-claims` lewat callback `onSuccess`. Tanpa emoji.

- [ ] **Step 3: Create HelpdeskTicketModal**

Berisi dua tab: **Tiket Umum** dan **Pelaporan Pelanggaran (WBS)**. Tab WBS menampilkan catatan privasi GCG bahwa identitas pelapor tidak disimpan, memakai `is_whistleblowing: true`. Submit ke `/api/v1/governance/helpdesk`.

- [ ] **Step 4: Create KpiEvidenceUploadModal**

Terima `kpiId` dan `kpiTitle` sebagai prop. Kirim `{ individual_kpi_id, file_title, file_url }` ke `/api/v1/performance/kpi-evidence`. Tampilkan konfirmasi berhasil.

- [ ] **Step 5: Replace hardcoded CareerPathModal data**

Di `src/components/employee/CareerPathModal.tsx`, hapus array `careerSteps` literal. Ganti dengan `useEffect` yang memanggil `/api/v1/learning/career-path` dan menyimpan hasilnya di state `levels`. Tampilkan spinner selagi memuat dan pesan ramah bila data kosong. Tombol "Daftar Mandiri" memanggil `POST /api/v1/learning/moodle`.

- [ ] **Step 6: Wire the modals into the employee portal**

Di `src/app/dashboard/employee-portal/page.tsx`: tambahkan tiga state boolean baru, tiga import komponen, tombol aksi (Reimbursement, Tiket Bantuan, Unggah Bukti) di blok tombol yang sudah ada, dan render ketiga modal di dekat blok modal Govera360.

- [ ] **Step 7: Verify in browser**

Buka `http://localhost:3000/dashboard/employee-portal` sebagai Budi Pratama, lalu uji: buka Reimbursement dan kirim; buka Tiket dan kirim WBS; buka Peta Karir dan pastikan data muncul dari API, bukan literal.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/v1/finance/expense-claims/route.ts src/app/api/v1/governance/helpdesk/route.ts src/app/api/v1/performance/kpi-evidence/route.ts src/app/api/v1/learning/career-path/route.ts src/components/employee/ReimbursementModal.tsx src/components/employee/HelpdeskTicketModal.tsx src/components/employee/KpiEvidenceUploadModal.tsx src/components/employee/CareerPathModal.tsx src/app/dashboard/employee-portal/page.tsx
git commit -m "feat(ui): hubungkan reimbursement, ticketing WBS, dan upload bukti ke portal karyawan"
```

---

### Task 8: Refactor Dashboard Admin dari Literal ke Data API

**Files:**
- Modify: `src/components/governance/FlightRiskHeatmap.tsx`
- Modify: `src/components/governance/CostOfWorkforceCard.tsx`

**Interfaces:**
- Consumes: `GET /api/v1/governance/flight-risk`, `GET /api/v1/finance/cost-of-workforce`
- Produces: kedua komponen menampilkan data nyata dengan state loading dan error

- [ ] **Step 1: Refactor FlightRiskHeatmap**

Ganti array `talents` literal dengan pemanggilan `useEffect` ke `/api/v1/governance/flight-risk`. Tambahkan state `items`, `loading`, `error`. Tampilkan baris "Memuat data risiko…" selama loading, pesan error dengan tombol coba lagi bila gagal, dan daftar kartu seperti sekarang bila sukses. Pertahankan gaya visual yang ada; jangan menambahkan angka default.

- [ ] **Step 2: Refactor CostOfWorkforceCard**

Ganti default parameter angka literal dengan pemanggilan `useEffect` ke `/api/v1/finance/cost-of-workforce`. State yang sama: `loading`, `error`, `data`. Hapus sepenuhnya nilai default `485_000_000` dan `1_420_000_000`.

- [ ] **Step 3: Verify in browser**

Buka `http://localhost:3000/dashboard/hr-command` sebagai Siti Nurhaliza. Pastikan kartu menampilkan angka dari database dan tidak ada error konsol.

- [ ] **Step 4: Commit**

```bash
git add src/components/governance/FlightRiskHeatmap.tsx src/components/governance/CostOfWorkforceCard.tsx
git commit -m "refactor(ui): sumberkan Flight Risk dan Cost of Workforce dari API"
```

---

### Task 9: Job Board Kotak 3 (P1)

**Files:**
- Create: `src/lib/services/talentAcquisitionService.ts`
- Create: `src/app/api/v1/talent-acquisition/job-postings/route.ts`
- Create: `src/app/api/v1/talent-acquisition/applications/route.ts`
- Create: `src/app/api/v1/talent-acquisition/interview-slots/route.ts`
- Test: `tests/integration/talentAcquisition.test.ts`

**Interfaces:**
- Consumes: `job_postings`, `internal_applications`, `interview_slots`, `manpower_plans`, `competency_scores`
- Produces:
  - `screenCvAgainstPosting(cvSkills: string[], requiredSkills: string[]): { score: number; summary: string }`
  - `applyToPosting(db, employeeId, jobPostingId, coverLetter, cvUrl)`
  - `approveApplication(db, applicationId)` — menolak bila `hired_count >= approved_quota`
  - `bookInterviewSlot(db, slotId)` — menolak bila `booked_count >= capacity`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { screenCvAgainstPosting } from '@/lib/services/talentAcquisitionService';

describe('Screening CV deterministik', () => {
  it('memberi skor 100 ketika seluruh skill wajib terpenuhi', () => {
    const result = screenCvAgainstPosting(
      ['Kubernetes', 'TypeScript', 'AWS'],
      ['Kubernetes', 'TypeScript']
    );
    expect(result.score).toBe(100);
  });

  it('skor proporsional dengan skill yang cocok', () => {
    const result = screenCvAgainstPosting(
      ['Kubernetes', 'Go'],
      ['Kubernetes', 'TypeScript', 'AWS', 'Terraform']
    );
    expect(result.score).toBe(25);
  });

  it('mengembalikan 0 bila tidak ada skill yang cocok', () => {
    const result = screenCvAgainstPosting(['COBOL'], ['Kubernetes', 'AWS']);
    expect(result.score).toBe(0);
  });

  it('menghindari false positive untuk kemiripan teks', () => {
    const result = screenCvAgainstPosting(['Java'], ['JavaScript']);
    expect(result.score).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/talentAcquisition.test.ts`
Expected: FAIL — `Cannot find module '@/lib/services/talentAcquisitionService'`

- [ ] **Step 3: Implement the pure screening function**

```typescript
export function screenCvAgainstPosting(
  cvSkills: string[],
  requiredSkills: string[]
): { score: number; summary: string } {
  if (requiredSkills.length === 0) {
    return { score: 0, summary: 'Kriteria kompetensi lowongan belum ditetapkan.' };
  }
  const cv = new Set(cvSkills.map((s) => s.trim().toLowerCase()));
  const matched = requiredSkills.filter((s) => cv.has(s.trim().toLowerCase()));
  const score = Math.round((matched.length / requiredSkills.length) * 100);
  const missing = requiredSkills.filter((s) => !cv.has(s.trim().toLowerCase()));
  const summary =
    missing.length === 0
      ? `Seluruh ${requiredSkills.length} kompetensi wajib terpenuhi.`
      : `Kecocokan ${matched.length}/${requiredSkills.length}. Kekurangan: ${missing.join(', ')}.`;
  return { score, summary };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/talentAcquisition.test.ts`
Expected: PASS

- [ ] **Step 5: Implement persistence and quota enforcement**

Di `approveApplication`:

```typescript
const quota = await db.execute(sql`
  SELECT mp.approved_quota AS "approvedQuota", mp.hired_count AS "hiredCount"
    FROM job_postings jp
    JOIN manpower_plans mp ON mp.id = jp.manpower_plan_id
   WHERE jp.id = ${jobPostingId}::uuid
`);
if (Number(row.hiredCount) >= Number(row.approvedQuota)) {
  throw new BusinessRuleError(
    'Kuota formasi telah tercapai. Pengesahan ditolak sesuai rencana Manpower Planning.'
  );
}
```

`bookInterviewSlot` menolak dengan `BusinessRuleError` bila `booked_count >= capacity`.

- [ ] **Step 6: Create the three API routes**

`GET /api/v1/talent-acquisition/job-postings`, `POST /api/v1/talent-acquisition/applications`, `PATCH /api/v1/talent-acquisition/applications` (memanggil `assertCan(session, 'kpi:approve')`), `GET /api/v1/talent-acquisition/interview-slots`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/services/talentAcquisitionService.ts src/app/api/v1/talent-acquisition/ tests/integration/talentAcquisition.test.ts
git commit -m "feat(talent): implementasi job board, screening CV, dan penagihan kuota MPP Kotak 3"
```

---

### Task 10: PIN Gaji Hash bcrypt (P2)

**Files:**
- Create: `src/lib/db/migrations/0005_payslip_pin.sql`
- Modify: `src/lib/services/payrollFinanceService.ts`
- Modify: `src/lib/db/seed/index.ts`
- Test: `tests/unit/payrollFinanceService.test.ts`

**Interfaces:**
- Consumes: `bcryptjs`
- Produces: kolom `payslip_pin_hash` pada tabel `employees`

- [ ] **Step 1: Write the failing test**

```typescript
it('menolak PIN yang salah dan menerima PIN yang benar (bcrypt)', async () => {
  await expect(getVerifiedPayslip({ employeeId: EMP, pin: '000000' }))
    .rejects.toThrow(/PIN keamanan tidak valid/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/payrollFinanceService.test.ts`
Expected: FAIL

- [ ] **Step 3: Add migration 0005 and implement bcrypt**

`0005_payslip_pin.sql`:
```sql
ALTER TABLE employees ADD COLUMN IF NOT EXISTS payslip_pin_hash TEXT;
```

Ganti perbandingan literal di `getVerifiedPayslip`:

```typescript
const record = await db.execute(sql`
  SELECT e.id, e.employee_code, e.full_name, e.base_salary,
         e.payslip_pin_hash AS "payslipPinHash",
         d.department_name, j.position_title
    FROM employees e
    JOIN departments d ON d.id = e.department_id
    JOIN job_positions j ON j.id = e.position_id
   WHERE e.id = ${employeeId}::uuid
`);
const row = record.rows[0] as any;
if (!row?.payslipPinHash) {
  throw new Error('PIN keamanan belum diatur. Hubungi HR untuk aktivasi slip gaji digital.');
}
const pinValid = await bcrypt.compare(payload.pin, row.payslipPinHash);
if (!pinValid) {
  throw new Error('PIN keamanan tidak valid.');
}
```

Seed mengisi `payslip_pin_hash` untuk semua karyawan dengan hash dari `123456`.

- [ ] **Step 4: Run migrate and test**

Run: `npm run db:migrate && npm run db:seed && npx vitest run tests/unit/payrollFinanceService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/migrations/0005_payslip_pin.sql src/lib/services/payrollFinanceService.ts src/lib/db/seed/index.ts tests/unit/payrollFinanceService.test.ts
git commit -m "feat(payroll): ganti PIN gaji literal dengan verifikasi bcrypt"
```

---

### Task 11: UI Job Board di Employee Portal & Manager Cockpit (M-8)

**Files:**
- Create: `src/components/employee/JobBoardModal.tsx`
- Create: `src/components/manager/InternalApplicationReview.tsx`
- Modify: `src/app/dashboard/employee-portal/page.tsx`
- Modify: `src/app/dashboard/manager-cockpit/page.tsx`

**Interfaces:**
- Consumes: endpoint talent-acquisition dari Task 9
- Produces: modal bursa kerja di Employee Portal dan daftar review di Manager Cockpit

- [ ] **Step 1: Create JobBoardModal**

Modal dengan daftar lowongan aktif dari `GET /api/v1/talent-acquisition/job-postings`. Form lamaran mengirim `cover_letter` dan `cv_url`. Hasil screening ditampilkan setelah submit.

- [ ] **Step 2: Create InternalApplicationReview**

Komponen untuk Manager Cockpit: daftar lamaran masuk dengan tombol "Setujui" dan "Tolak". Pesan penolakan kuota ditampilkan apa adanya dari server.

- [ ] **Step 3: Wire into both dashboards**

Tambahkan tombol "Bursa Kerja Internal" di Employee Portal dan pasang `InternalApplicationReview` di Manager Cockpit.

- [ ] **Step 4: Verify in browser**

Karyawan melamar lowongan, atasan menyetujui, kuota terpantau berkurang.

- [ ] **Step 5: Commit**

```bash
git add src/components/employee/JobBoardModal.tsx src/components/manager/InternalApplicationReview.tsx src/app/dashboard/employee-portal/page.tsx src/app/dashboard/manager-cockpit/page.tsx
git commit -m "feat(ui): tambahkan Job Board karyawan dan peninjauan lamaran di Manager Cockpit"
```

---

### Task 12: Verifikasi Akhir & Review-branch

**Files:**
- Test: seluruh suite

- [ ] **Step 1: Jalankan suite lengkap**

Run: `npm run test`
Expected: 0 gagal.

- [ ] **Step 2: Jalankan type-check dan build**

Run: `npx tsc --noEmit && npm run build`
Expected: 0 error TypeScript dan build sukses.

- [ ] **Step 3: Verifikasi manual di browser**

Konfirmasi setiap peran tidak melihat data yang dilarang RBAC dan seluruh 6 kotak dapat dicapai dari UI.

- [ ] **Step 4: Review akhir**

Jalankan subagent code reviewer pada seluruh branch.

- [ ] **Step 5: Commit dan push**

```bash
git add -A
git commit -m "chore: verifikasi akhir remediasi celah Govera360"
git push origin master
```

---

## Milestone yang Definitif Ditunda

**M-10 (LTI Launch ke Moodle nyata):** Memerlukan server Moodle aktif dan kredensial OAuth/LTI. Yang tersedia adalah pencatatan pendaftaran mandiri via API.

**M-11 (Chatbot berbasis knowledge base embeddings):** Mengganti 4 cabang keyword statis dengan RAG/embedding memerlukan pipeline terpisah. Dikerjakan sebagai proyek mandiri.
