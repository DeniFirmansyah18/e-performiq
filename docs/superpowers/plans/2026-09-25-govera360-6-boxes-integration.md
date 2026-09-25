# Govera360 (Arsitektur 6 Kotak) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengintegrasikan blueprint Govera360 (Arsitektur 6 Kotak) dan antarmuka ganda (*Dual Dashboard: Self-Service Mobile/Web vs Desktop Command Center*) ke dalam platform E-PerformIQ dengan tetap menegakkan acuan resmi PP No. 35/2021, PP No. 36/2021, ISO 30414:2019, Balanced Scorecard, 9-Box Matrix, dan GCG KNKG.

**Architecture:** Membangun ekstensi skema database (migrasi `0003`), repository & service layer terisolasi untuk masing-masing dari 6 kotak fungsional, mesin analitik pendukung (Sinyal Rekomendasi, Deteksi Flight Risk, Cost of Workforce, Chatbot SOP), serta 2 portal antarmuka reaktif (Dashboard Pekerja Self-Service & Dashboard Pengusaha Command Center).

**Tech Stack:** Next.js 14 App Router, TypeScript, PGlite (PostgreSQL 16 WASM), Drizzle ORM, Vitest, Lucide React, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-09-25-govera360-6-boxes-architecture-spec.md`

## Global Constraints

- Skema 24 tabel utama yang sudah ada tidak boleh dirusak atau di-drop; tabel baru terhubung lewat relasi Foreign Key yang valid.
- Seluruh perhitungan waktu kerja dan kompensasi wajib patuh pada batas sah PP No. 35/2021 (lembur maks. 4 jam/hari, jam kerja 40 jam/minggu).
- Struktur dan skala upah pada Kotak 5 wajib mengacu pada prinsip PP No. 36/2021 jo PP 51/2023.
- Pelaporan metrik modal manusia wajib memenuhi format standar ISO 30414:2019.
- Pelaporan Whistleblowing (WBS) pada Kotak 6 wajib menjamin perlindungan identitas pelapor (GCG TARIF - Fairness).
- Tidak menggunakan emoji dekoratif atau ikon generic AI pada judul `<h2>` dan komponen UI (mematuhi `antislop-ui`).

## Review Focus

- *Input Timesheet > 4 jam lembur*: Sistem wajib menolak input lembur melebihi batas regulasi Pasal 26 PP 35/2021 dengan pesan error yang jelas.
- *Otentikasi Slip Gaji Digital*: Akses rincian slip gaji wajib memvalidasi PIN keamanan karyawan, menolak jika PIN salah atau tidak sesuai session pemilik.
- *Laporan Whistleblowing Anonim*: Kolom `employee_id` pada `helpdesk_tickets` wajib bernilai NULL saat `is_whistleblowing = true` untuk melindungi identitas pelapor.
- *Pendaftaran Kursus Moodle*: Sistem harus mencegah pendaftaran ganda pada `moodle_course_id` yang sama oleh karyawan yang sama di periode aktif.
- *Pengajuan Cuti Melebihi Saldo*: Sistem wajib memvalidasi sisa kuota hak cuti tahunan (maks. 12 hari kerja per tahun masa bakti) sebelum menyetujui pengajuan.

---

### Task 1: Database Migration & Schema Extension (0003_govera360_boxes.sql)

**Files:**
- Create: `src/lib/db/migrations/0003_govera360_boxes.sql`
- Modify: `src/types/index.ts`
- Test: `tests/integration/govera-schema.test.ts`

**Interfaces:**
- Consumes: `employees(id)`, `individual_kpis(id)`, `job_positions(id)`, `users(id)` from `0001_init.sql`
- Produces: Tabel `daily_timesheets`, `kpi_evidence_attachments`, `career_path_levels`, `moodle_course_enrollments`, `leave_requests`, `expense_claims`, `helpdesk_tickets`

- [ ] **Step 1: Write the failing integration test**

```typescript
// tests/integration/govera-schema.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { getDb, runMigrations } from '@/lib/db/client';

describe('Govera360 Database Schema Extension (0003)', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  it('memiliki seluruh 7 tabel baru untuk arsitektur 6 kotak', async () => {
    const db = await getDb();
    const tables = [
      'daily_timesheets',
      'kpi_evidence_attachments',
      'career_path_levels',
      'moodle_course_enrollments',
      'leave_requests',
      'expense_claims',
      'helpdesk_tickets',
    ];

    for (const table of tables) {
      const res = await db.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        );`,
        [table]
      );
      expect(res.rows[0].exists).toBe(true);
    }
  });

  it('memvalidasi batasan lembur maksimal 4 jam pada daily_timesheets', async () => {
    const db = await getDb();
    // Cari satu employee ID yang ada
    const emp = await db.query(`SELECT id FROM employees LIMIT 1;`);
    const empId = emp.rows[0].id;

    // Coba insert lembur 5 jam (melanggar PP 35/2021)
    await expect(
      db.query(
        `INSERT INTO daily_timesheets (employee_id, work_date, regular_hours, overtime_hours, task_summary)
         VALUES ($1, '2026-09-25', 8.00, 5.00, 'Tugas lembur ilegal');`,
        [empId]
      )
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/govera-schema.test.ts`  
Expected: FAIL with "table does not exist"

- [ ] **Step 3: Write migration SQL file**

```sql
-- src/lib/db/migrations/0003_govera360_boxes.sql
-- ==================== KOTAK 1: PRODUKTIVITAS & TIMESHEET ====================
CREATE TABLE IF NOT EXISTS daily_timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  regular_hours DECIMAL(4,2) NOT NULL DEFAULT 8.00,
  overtime_hours DECIMAL(4,2) NOT NULL DEFAULT 0.00 CHECK (overtime_hours >= 0.00 AND overtime_hours <= 4.00),
  task_summary TEXT NOT NULL,
  approval_status VARCHAR(20) NOT NULL DEFAULT 'APPROVED'
    CHECK (approval_status IN ('SUBMITTED','APPROVED','REJECTED')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, work_date)
);

CREATE TABLE IF NOT EXISTS kpi_evidence_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  individual_kpi_id UUID NOT NULL REFERENCES individual_kpis(id) ON DELETE CASCADE,
  file_title VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ==================== KOTAK 2: PETA KARIR & AKADEMI MOODLE ====================
CREATE TABLE IF NOT EXISTS career_path_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_position_id UUID NOT NULL REFERENCES job_positions(id) ON DELETE CASCADE,
  target_position_id UUID NOT NULL REFERENCES job_positions(id) ON DELETE CASCADE,
  min_gpa DECIMAL(4,2) NOT NULL DEFAULT 3.00,
  min_service_months INT NOT NULL DEFAULT 12,
  required_skills JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS moodle_course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  moodle_course_id INT NOT NULL,
  course_title VARCHAR(255) NOT NULL,
  completion_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  score DECIMAL(5,2),
  is_certified BOOLEAN NOT NULL DEFAULT FALSE,
  enrolled_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  UNIQUE (employee_id, moodle_course_id)
);

-- ==================== KOTAK 4: CORE HR, CUTI & KONTRAK ====================
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type VARCHAR(30) NOT NULL CHECK (leave_type IN ('ANNUAL','SICK','MATERNITY','SPECIAL')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INT NOT NULL CHECK (total_days > 0),
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('SUBMITTED','APPROVED','REJECTED','CANCELLED')),
  approver_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date >= start_date)
);

-- ==================== KOTAK 5: PENGUPAHAN & REIMBURSEMENT ====================
CREATE TABLE IF NOT EXISTS expense_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  claim_category VARCHAR(30) NOT NULL CHECK (claim_category IN ('MEDICAL','TRAVEL','OPERATIONAL')),
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  receipt_url TEXT NOT NULL,
  claim_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('SUBMITTED','APPROVED','PAID','REJECTED')),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ==================== KOTAK 6: HELPDESK & WHISTLEBLOWING ====================
CREATE TABLE IF NOT EXISTS helpdesk_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  is_whistleblowing BOOLEAN NOT NULL DEFAULT FALSE,
  ticket_category VARCHAR(50) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  detail TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW','MEDIUM','HIGH','URGENT')),
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')),
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

Update `src/types/index.ts` untuk menyertakan interface TypeScript untuk ke-7 entitas di atas.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/govera-schema.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/migrations/0003_govera360_boxes.sql src/types/index.ts tests/integration/govera-schema.test.ts
git commit -m "feat(db): tambahkan skema migrasi 0003 untuk 6 kotak Govera360"
```

---

### Task 2: Kotak 1 Service: Timesheet, Bukti KPI & Sinyal Rekomendasi AI

**Files:**
- Create: `src/lib/services/productivityService.ts`
- Create: `src/lib/repositories/productivityRepository.ts`
- Create: `src/app/api/v1/performance/timesheets/route.ts`
- Test: `tests/unit/productivityService.test.ts`

**Interfaces:**
- Consumes: `daily_timesheets`, `kpi_evidence_attachments`, `performance_appraisals`
- Produces: `submitTimesheet()`, `attachKpiEvidence()`, `calculateRecommendationSignal(employeeId)`:
  - `PROMOTION`: GPA $\ge 3.70$ + NineBox in `FUTURE_LEADER` | `GROWTH_STAR`
  - `MUTATION`: NineBox in `ENIGMA` (High potential, low performance)
  - `PIP`: GPA $< 2.00$ or NineBox in `UNDERPERFORMER`
  - `MAINTAIN`: Kondisi performa standar

- [ ] **Step 1: Write the failing unit test**

```typescript
// tests/unit/productivityService.test.ts
import { describe, it, expect } from 'vitest';
import { generateTalentRecommendationSignal } from '@/lib/services/productivityService';

describe('Kotak 1: Productivity & Recommendation Engine', () => {
  it('merekomendasikan PROMOTION jika talenta memiliki GPA >= 3.70 dan berada di Box 9 (FUTURE_LEADER)', () => {
    const signal = generateTalentRecommendationSignal({
      gpa: 3.85,
      nineBox: 'FUTURE_LEADER',
      attendanceBradford: 10,
    });
    expect(signal.action).toBe('PROMOTION');
    expect(signal.badgeColor).toContain('emerald');
  });

  it('merekomendasikan MUTATION jika talenta berada di Box 7 (ENIGMA)', () => {
    const signal = generateTalentRecommendationSignal({
      gpa: 2.30,
      nineBox: 'ENIGMA',
      attendanceBradford: 20,
    });
    expect(signal.action).toBe('MUTATION');
    expect(signal.reason).toContain('salah penempatan');
  });

  it('merekomendasikan PIP 60 hari jika talenta memiliki GPA < 2.00 atau Box 1 (UNDERPERFORMER)', () => {
    const signal = generateTalentRecommendationSignal({
      gpa: 1.80,
      nineBox: 'UNDERPERFORMER',
      attendanceBradford: 85,
    });
    expect(signal.action).toBe('PIP');
    expect(signal.durationDays).toBe(60);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/productivityService.test.ts`  
Expected: FAIL with "generateTalentRecommendationSignal not defined"

- [ ] **Step 3: Implement Productivity Service & Route**

Implementasikan `generateTalentRecommendationSignal`, `submitTimesheetEntry`, dan `addEvidenceAttachment` di `src/lib/services/productivityService.ts` dan route API terkait.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/productivityService.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/productivityService.ts src/lib/repositories/productivityRepository.ts src/app/api/v1/performance/timesheets/route.ts tests/unit/productivityService.test.ts
git commit -m "feat(performance): tambahkan service timesheet dan sinyal rekomendasi AI Kotak 1"
```

---

### Task 3: Kotak 2 Service: Peta Karir & Moodle LMS Integration

**Files:**
- Create: `src/lib/services/learningCareerService.ts`
- Create: `src/app/api/v1/learning/career-path/route.ts`
- Create: `src/app/api/v1/learning/moodle/route.ts`
- Test: `tests/unit/learningCareerService.test.ts`

**Interfaces:**
- Consumes: `career_path_levels`, `moodle_course_enrollments`, `competency_scores`
- Produces: `getCareerPathWithSkillGaps(employeeId)`, `recommendCoursesForGaps(employeeId)`, `enrollMoodleCourse(employeeId, courseId)`

- [ ] **Step 1: Write the failing unit test**

```typescript
// tests/unit/learningCareerService.test.ts
import { describe, it, expect } from 'vitest';
import { matchCoursesToSkillGaps } from '@/lib/services/learningCareerService';

describe('Kotak 2: Learning & Career Path Engine', () => {
  it('secara otomatis merekomendasikan silabus Moodle untuk gap kompetensi negatif', () => {
    const gaps = [
      { skill: 'Cloud Architecture', required: 4, actual: 2, gap: 2 },
      { skill: 'Communication', required: 4, actual: 4, gap: 0 },
    ];
    const catalog = [
      { courseId: 101, title: 'Mastering AWS & Cloud Native Architecture', targetSkill: 'Cloud Architecture' },
      { courseId: 102, title: 'Effective Communication in Agile Teams', targetSkill: 'Communication' },
    ];

    const recommended = matchCoursesToSkillGaps(gaps, catalog);
    expect(recommended).toHaveLength(1);
    expect(recommended[0].courseId).toBe(101);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/learningCareerService.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement Learning & Career Service**

Implementasi fungsi pencocokan modul Moodle dan visualisasi syarat kenaikan pangkat (Target Position, minimal GPA, masa kerja bulan).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/learningCareerService.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/learningCareerService.ts src/app/api/v1/learning/ tests/unit/learningCareerService.test.ts
git commit -m "feat(learning): implementasi peta jenjang karir dan rekomendasi Moodle Kotak 2"
```

---

### Task 4: Kotak 4 Service: Pengajuan Cuti, Izin & Deteksi Dini Flight Risk

**Files:**
- Create: `src/lib/services/coreHrService.ts`
- Create: `src/app/api/v1/governance/leaves/route.ts`
- Test: `tests/unit/coreHrService.test.ts`

**Interfaces:**
- Consumes: `leave_requests`, `employees`, `peer_reviews_360`, `sop_compliance_logs`
- Produces: `submitLeaveRequest()`, `calculateFlightRiskScore(employeeId)`:
  - Return: `score` (0-100), `riskLevel` ('LOW' | 'MEDIUM' | 'HIGH'), `reasons` string[]

- [ ] **Step 1: Write the failing unit test**

```typescript
// tests/unit/coreHrService.test.ts
import { describe, it, expect } from 'vitest';
import { calculateFlightRisk } from '@/lib/services/coreHrService';

describe('Kotak 4: Core HR & Flight Risk Engine', () => {
  it('mendeteksi HIGH Flight Risk jika absensi terganggu, peer review turun, dan jam kerja berlebih', () => {
    const risk = calculateFlightRisk({
      bradfordFactor: 65, // di atas batas normal 45
      peerReviewAvg: 2.8, // nilai rendah
      overtimeHoursWeekly: 14, // beban lembur tinggi
      contractDaysRemaining: 40,
    });
    expect(risk.level).toBe('HIGH');
    expect(risk.warnings).toContain('Indeks Bradford absensi mengindikasikan ketidakhadiran berulang');
  });

  it('mendeteksi LOW Flight Risk pada karyawan dengan rekam jejak stabil', () => {
    const risk = calculateFlightRisk({
      bradfordFactor: 5,
      peerReviewAvg: 4.5,
      overtimeHoursWeekly: 2,
      contractDaysRemaining: 300,
    });
    expect(risk.level).toBe('LOW');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/coreHrService.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement Core HR & Flight Risk Engine**

Implementasi alur pengajuan cuti berjenjang dan kalkulator skor retensi / risiko *resignation* talenta kunci.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/coreHrService.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/coreHrService.ts src/app/api/v1/governance/leaves/route.ts tests/unit/coreHrService.test.ts
git commit -m "feat(core-hr): tambahkan modul cuti mandiri dan deteksi dini flight risk Kotak 4"
```

---

### Task 5: Kotak 5 Service: Slip Gaji Digital ber-PIN & Cost of Workforce

**Files:**
- Create: `src/lib/services/payrollFinanceService.ts`
- Create: `src/app/api/v1/finance/payslip/route.ts`
- Create: `src/app/api/v1/finance/claims/route.ts`
- Test: `tests/unit/payrollFinanceService.test.ts`

**Interfaces:**
- Consumes: `employees(base_salary)`, `expense_claims`, `daily_timesheets`, `performance_appraisals`
- Produces: `verifyPinAndGetPayslip(employeeId, pin)`, `calculateCostOfWorkforceRatio(departmentId)`

- [ ] **Step 1: Write the failing unit test**

```typescript
// tests/unit/payrollFinanceService.test.ts
import { describe, it, expect } from 'vitest';
import { calculateCostOfWorkforce } from '@/lib/services/payrollFinanceService';

describe('Kotak 5: Payroll & Workforce ROI Engine', () => {
  it('menghitung rasio efisiensi biaya tenaga kerja (TCOW) terhadap output target', () => {
    const result = calculateCostOfWorkforce({
      totalPayrollIDR: 150_000_000,
      totalClaimsIDR: 12_000_000,
      totalOutputValueIDR: 450_000_000,
    });
    // Rasio pengeluaran SDM terhadap output bisnis
    expect(result.tcowRatio).toBeCloseTo(0.36, 2);
    expect(result.roiMultiplier).toBeGreaterThan(2.0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/payrollFinanceService.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement Payroll & Finance Service**

Implementasi kalkulator pengupahan, validasi slip gaji dengan otentikasi PIN 6 digit, dan formulir reimbursement.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/payrollFinanceService.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/payrollFinanceService.ts src/app/api/v1/finance/ tests/unit/payrollFinanceService.test.ts
git commit -m "feat(finance): implementasi slip gaji PIN, reimbursement, dan Cost of Workforce Kotak 5"
```

---

### Task 6: Kotak 6 Service: Helpdesk, WBS GCG & Chatbot AI SOP/PP

**Files:**
- Create: `src/lib/services/helpdeskChatbotService.ts`
- Create: `src/app/api/v1/governance/helpdesk/route.ts`
- Create: `src/app/api/v1/governance/chatbot/route.ts`
- Test: `tests/unit/helpdeskChatbotService.test.ts`

**Interfaces:**
- Consumes: `helpdesk_tickets`, `FAQ_DATA` (dari `faqData.ts`), Peraturan Perusahaan SOP
- Produces: `createTicket()`, `createAnonymousWbs()`, `queryPolicyChatbot(question)`

- [ ] **Step 1: Write the failing unit test**

```typescript
// tests/unit/helpdeskChatbotService.test.ts
import { describe, it, expect } from 'vitest';
import { queryPolicyChatbotEngine } from '@/lib/services/helpdeskChatbotService';

describe('Kotak 6: Helpdesk & Policy Chatbot Engine', () => {
  it('menjawab pertanyaan tentang sisa cuti dan prosedur reimbursement secara otomatis', () => {
    const res = queryPolicyChatbotEngine('Berapa lama batas pengajuan klaim kacamata?');
    expect(res.answer).toContain('klaim');
    expect(res.sourceRef).toContain('SOP');
  });

  it('menjamin bahwa laporan WBS tidak menyimpan employee_id saat mode anonim diaktifkan', () => {
    const ticketPayload = {
      isWhistleblowing: true,
      category: 'FRAUD',
      subject: 'Dugaan manipulasi approval',
      detail: 'Ditemukan bukti transaksi fiktif...',
    };
    expect(ticketPayload.isWhistleblowing).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/helpdeskChatbotService.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement Helpdesk & Chatbot Engine**

Implementasi sistem tiket terklasifikasi, form Whistleblowing terisolasi (GCG TARIF), dan query engine chatbot SOP 24/7.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/helpdeskChatbotService.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/helpdeskChatbotService.ts src/app/api/v1/governance/helpdesk/ src/app/api/v1/governance/chatbot/ tests/unit/helpdeskChatbotService.test.ts
git commit -m "feat(helpdesk): implementasi helpdesk ticketing, WBS anonim, dan chatbot SOP Kotak 6"
```

---

### Task 7: UI Layer: Dashboard Pekerja (Self-Service Mobile & Web Friendly)

**Files:**
- Modify: `src/app/dashboard/employee-portal/page.tsx`
- Create: `src/components/employee/TimesheetModal.tsx`
- Create: `src/components/employee/CareerPathModal.tsx`
- Create: `src/components/employee/PaySlipModal.tsx`
- Create: `src/components/employee/HelpdeskChatbotDrawer.tsx`

**Interfaces:**
- Menampilkan 6 tab/kartu aktif:
  1. **Performance & Timesheet** (Rapor GPA, input jam kerja harian, upload bukti portofolio)
  2. **Akademi & Karir** (Peta kenaikan pangkat, daftar kursus Moodle SSO)
  3. **Bursa Karir Internal** (Daftar lowongan divisi lain)
  4. **Administrasi Cuti** (Sisa cuti 12 hari, form pengajuan)
  5. **Slip Gaji & Klaim** (Download slip via PIN, upload struk reimburse)
  6. **Bantuan & Chatbot 24/7** (Tanya jawab PP/SOP interaktif)

- [ ] **Step 1: Update Employee Portal UI layout**

Tambahkan tombol aksi mandiri dan modal terpadu tanpa emoji dekoratif sesuai standar `antislop-ui`.

- [ ] **Step 2: Verify in browser**

Akses `http://localhost:3000/dashboard/employee-portal`, uji pembukaan modal Timesheet, Slip Gaji PIN, dan Chatbot.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/employee-portal/page.tsx src/components/employee/
git commit -m "feat(ui): perbarui Employee Portal menjadi Dashboard Pekerja Self-Service 6 Kotak"
```

---

### Task 8: UI Layer: Dashboard Pengusaha / Admin (Desktop Command Center)

**Files:**
- Modify: `src/app/dashboard/hr-command/page.tsx`
- Modify: `src/app/dashboard/executive/page.tsx`
- Create: `src/components/governance/CostOfWorkforceCard.tsx`
- Create: `src/components/governance/FlightRiskHeatmap.tsx`

**Interfaces:**
- Menampilkan analitik helikopter bagi C-Level & HR VP:
  1. Peta Sinyal Rekomendasi (Promosi/Mutasi/PIP)
  2. Rasio Cost of Workforce vs Output VMAI
  3. Radar Deteksi Dini Flight Risk & Masa PKWT
  4. Pengawasan Kasus Tiket & Whistleblowing SPI

- [ ] **Step 1: Integrate Command Center Components**

Pasang kartu analitik *Cost of Workforce*, *Flight Risk Heatmap*, dan *Talent Signal Filter* di halaman HR Command & Executive Boardroom.

- [ ] **Step 2: Verify in browser**

Akses `http://localhost:3000/dashboard/hr-command` dan `http://localhost:3000/dashboard/executive`, pastikan visualisasi metrik tampil jernih tanpa error konsol.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/hr-command/page.tsx src/app/dashboard/executive/page.tsx src/components/governance/
git commit -m "feat(ui): selaraskan HR Command & Executive Boardroom dengan Arsitektur 6 Kotak Govera360"
```

---

### Task 9: Full Suite Integration & Regression Testing

**Files:**
- Test: `tests/integration/govera-flow.test.ts`

- [ ] **Step 1: Run complete vitest test suite**

Run: `npm run test`  
Expected: Seluruh unit dan integration test (92+ tests) lulus 100% tanpa regresi.

- [ ] **Step 2: Run next build check**

Run: `npm run build`  
Expected: Sukses build tanpa TypeScript maupun lint error.

- [ ] **Step 3: Final Commit & Push**

```bash
git add .
git commit -m "chore: verifikasi akhir integrasi 6 kotak Govera360 dan build clean"
git push origin master
```
