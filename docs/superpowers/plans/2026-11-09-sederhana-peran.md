# Penyederhanaan Peran, Hapus Audit & Kalibrasi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplikasi hanya punya lima peran (tanpa AUDITOR), tanpa modul audit dan tanpa kalibrasi nilai, dengan navigasi datar dan Super Admin yang hanya melihat panel hak akses.

**Architecture:** Lima task berurutan, masing-masing satu lapisan: lepas AUDITOR → hapus kalibrasi → hapus modul audit → khususkan Super Admin → ratakan menu. Melepas AUDITOR lebih dulu membuat task berikutnya tidak perlu mempertimbangkan peran itu lagi.

**Tech Stack:** Next.js 14 App Router, TypeScript, Drizzle ORM di atas PGlite/PostgreSQL, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-09-sederhana-peran-design.md`

## Global Constraints

- Peran akhir **hanya**: `SUPER_ADMIN`, `BOD`, `HR_MANAGER`, `PEOPLE_MANAGER`, `EMPLOYEE`.
- `AUDITOR` **tetap ada di tipe enum PostgreSQL** (tidak dihapus dari DB); hanya berhenti dipakai. Preseden `0061_remove_assessor_role`.
- Tabel `audit_logs` dan `insertAuditLog` **dipertahankan** — dipakai login, logout, profil, penugasan manajer, flight-risk, board analysis.
- Yang dihapus dari modul audit: halaman `audit-governance`, `GET /api/v1/governance/audit-logs`, `GET /api/v1/audit/integrity`, penulisan hash chain, dan tesnya.
- Kalibrasi dihapus total: `PUT /performance/appraisals/:id/calibrate`, parameter `approve`, `setAppraisalCalibrated`, seluruh UI kalibrasi, dan permission `appraisal:calibrate`.
- Nilai yang dulu terkunci menjadi bisa dihitung ulang (keputusan pemilik produk).
- SUPER_ADMIN: menu hanya `Manajemen Akun`; izin RBAC tetap penuh (termasuk `user:manage`).
- Menu datar: satu deret tautan top-level, tanpa dropdown "Portals"/"Modul & Tata Kelola".
- Tidak mengubah rumus GPA/9-Box.
- Tidak boleh ada mojibake/BOM (`tests/unit/nineBoxTextQuality.test.ts`).

## Review Focus

1. **Akun lama berperan AUDITOR di database** — bila ada, login harus gagal dengan pesan jelas, bukan crash 500 atau masuk dengan peran tak dikenal. Uji di Task 1.
2. **Seed dijalankan ulang** — tidak boleh membuat akun AUDITOR baru dan tidak boleh gagal karena FK (Bambang dipakai di beberapa tabel). Uji di Task 1.
3. **Menghitung ulang nilai yang dulu terkunci** — harus berhasil (200) dan nilainya berubah, bukan 409. Uji di Task 2.
4. **SUPER_ADMIN membuka dashboard lain** — dialihkan ke panel akun, tetapi API tetap bisa dipanggil (tidak 403). Uji di Task 4.
5. **Halaman/rute yang dihapus** — `/dashboard/audit-governance` tidak lagi dapat diakses siapa pun dan tidak muncul di menu. Uji di Task 3.

**Urutan wajib (a) → (b) → (c) → (d) → (e).**

---

### Task 1 (a): Lepas peran AUDITOR

**Files:**
- Modify: `src/types/index.ts` (`UserRole`), `src/lib/auth/rbac.ts`, `src/lib/auth/scope.ts`, `src/middleware.ts`, `src/components/navigation/NavMenu.tsx`, `src/app/page.tsx`, `src/app/login/page.tsx`, `src/components/admin/AccountManagementPanel.tsx`, `src/lib/context/AuthContext.tsx`, `src/lib/services/notificationService.ts`, `src/lib/services/aiService.ts`, `src/lib/employee/plainLanguage.ts`, `src/components/ui/TermTooltip.tsx`, `src/components/guide/faqData.ts`, `src/components/guide/UserGuideModal.tsx`, route handler yang menyebut AUDITOR
- Modify seed: `src/lib/db/seed/index.ts`, `src/lib/db/seed/lifecycle-seed.ts`, `src/lib/db/seed/talent-contract-seed.ts`
- Test: `tests/unit/rbac.test.ts` (modify), `tests/integration/roleScope.test.ts` (modify), `tests/integration/scope.test.ts` (modify), `tests/unit/roles.test.ts` (create)

**Interfaces:**
- Consumes: —
- Produces: `UserRole` tanpa `'AUDITOR'`; `USER_ROLES` (const array) berisi lima peran — dipakai Task 4 untuk panel akun.

- [ ] **Step 1: Write the failing test**

`tests/unit/roles.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ROLE_LIST } from '@/types';
import { can } from '@/lib/auth/rbac';

describe('peran setelah penyederhanaan', () => {
  it('hanya ada lima peran, tanpa AUDITOR', () => {
    expect(ROLE_LIST).toEqual(['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE']);
    expect(ROLE_LIST).not.toContain('AUDITOR');
  });

  it('tidak ada permission yang masih memberi akses ke AUDITOR', () => {
    // Dipanggil lewat string, bukan tipe, agar tes tidak bergantung pada tipe UserRole.
    const audit: Array<[string, Parameters<typeof can>[1]]> = [
      ['audit:read', 'audit:read'],
      ['payroll:read', 'payroll:read'],
      ['analytics:read', 'analytics:read'],
      ['kpi:read', 'kpi:read'],
    ];
    for (const [, perm] of audit) {
      expect(can('AUDITOR' as any, perm)).toBe(false);
    }
  });
});
```

Catatan: `can()` mengembalikan `false` untuk peran di luar tipe. Karena `MATRIX[permission]` tidak lagi memuat `'AUDITOR'`, `.includes()` bernilai false — bukan melempar.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/roles.test.ts`
Expected: FAIL — `ROLE_LIST` tidak diekspor dari `@/types`.

- [ ] **Step 3: Lepas AUDITOR dari kode**

- `src/types/index.ts`: `UserRole` tanpa `'AUDITOR'`; ekspor `export const ROLE_LIST = ['SUPER_ADMIN','BOD','HR_MANAGER','PEOPLE_MANAGER','EMPLOYEE'] as const;` (tipe `UserRole` diturunkan dari situ bila memungkinkan).
- `src/lib/auth/rbac.ts`: hapus `'AUDITOR'` dari setiap entri matriks; hapus permission `audit:read` bila tidak ada lagi pemakainya (cek dulu pemakaian `assertCan(..., 'audit:read')`).
- `src/lib/auth/scope.ts`: hapus dari `ORG_WIDE_ROLES`.
- `src/middleware.ts`: hapus dari `DASHBOARD_ROLES` dan `homeForRole`.
- `src/components/navigation/NavMenu.tsx`, `src/app/page.tsx`, `src/app/login/page.tsx`, `src/components/admin/AccountManagementPanel.tsx`, `src/lib/context/AuthContext.tsx`: hapus rujukan AUDITOR.
- `notificationService`, `aiService`, `plainLanguage`, `TermTooltip`, `faqData`, `UserGuideModal`, dan route handler yang menyebut AUDITOR: hapus rujukannya (ganti daftar peran menjadi lima).
- Seed: hapus akun `bambang.audit@` (baris user `e0000000-…-0005`), hapus baris karyawan `b0000000-…-0005` **beserta baris turunannya** di `index.ts`, `lifecycle-seed.ts`, `talent-contract-seed.ts` agar FK tidak gagal.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/roles.test.ts`
Expected: PASS (2 tes)

- [ ] **Step 5: Perbaiki tes lama yang menyebut AUDITOR**

Sesuaikan `tests/unit/rbac.test.ts`, `tests/integration/roleScope.test.ts`, `tests/integration/scope.test.ts` dan berkas tes lain yang masih memakai `'AUDITOR'` — ganti dengan peran lain yang setara untuk kasus ujinya, atau hapus kasus yang memang khusus AUDITOR.

Run: `npx vitest run tests/unit tests/integration/roleScope.test.ts tests/integration/scope.test.ts`
Expected: PASS

- [ ] **Step 6: Verifikasi seed bersih**

Run: `npm run db:reset`
Expected: migrasi + seed selesai tanpa error FK; akun `bambang.audit@` tidak ada.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(auth): lepas peran AUDITOR, sisakan lima peran"
```

---

### Task 2 (b): Hapus kalibrasi penilaian

**Files:**
- Delete: `src/app/api/v1/performance/appraisals/[id]/calibrate/route.ts`, `tests/integration/appraisalCalibrate.test.ts`, `tests/ui/ninebox-calibrate-flow.test.tsx`
- Modify: `src/lib/services/appraisalService.ts`, `src/lib/repositories/appraisalRepository.ts`, `src/app/api/v1/performance/appraisals/calculate-gpa/route.ts`, `src/app/dashboard/ninebox-matrix/page.tsx`, `src/app/dashboard/manager-cockpit/page.tsx`, `src/lib/auth/rbac.ts`, `src/lib/db/seed/index.ts`, `src/lib/services/gpaBatchService.ts`
- Test: `tests/integration/gpaNoLock.test.ts` (create)

**Interfaces:**
- Consumes: `calculateAndSaveGPA(db, session, input)` dari Task 1 (tanpa perubahan tanda tangan selain penghapusan `approve`).
- Produces: `calculateAndSaveGPA` kembali ke `(db, session, input: CalculateGPAInput) => Promise<Appraisal>`; `CalculateGPAInput` tanpa `approve`; tidak ada ekspor `setAppraisalCalibrated`.

- [ ] **Step 1: Write the failing test**

`tests/integration/gpaNoLock.test.ts` — salin pola helper `sess`/`createTestDb` dari `tests/integration/services.test.ts`.

```ts
it('nilai yang dulu terkunci dapat dihitung ulang (tidak 409)', async () => {
  const sebelum = await appraisalService.getAppraisalByEmployee(db, BUDI, PERIOD_ID);
  expect(sebelum!.isCalibrated).toBe(false); // seed baru tidak mengunci

  const hasil = await appraisalService.calculateAndSaveGPA(db, sess('HR_MANAGER', SITI), {
    periodId: PERIOD_ID, employeeId: BUDI, kpiScore: 50, sopScore: 50, competencyScore: 50, coreValuesScore: 50,
  });
  expect(Number(hasil.compositeGPA)).toBe(2);
  expect(hasil.isCalibrated).toBe(false);
});

it('PEOPLE_MANAGER dapat menyimpan hasil kalkulasi tanpa perlu izin khusus', async () => {
  const hasil = await appraisalService.calculateAndSaveGPA(db, sess('PEOPLE_MANAGER', DANU), {
    periodId: PERIOD_ID, employeeId: ANISA, kpiScore: 80, sopScore: 80, competencyScore: 80, coreValuesScore: 80,
  });
  expect(Number(hasil.compositeGPA)).toBeGreaterThan(0);
});

it('permission appraisal:calibrate tidak ada lagi', () => {
  expect(() => assertCan(sess('HR_MANAGER', SITI) as any, 'appraisal:calibrate' as any)).toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/gpaNoLock.test.ts`
Expected: FAIL — seed masih mengunci (isCalibrated true) dan `appraisal:calibrate` masih ada.

- [ ] **Step 3: Hapus kalibrasi**

- Hapus berkas `[id]/calibrate/route.ts`.
- `appraisalService`: buang `approve`, blok `ForbiddenError`, blok `ImmutableRecordError` untuk baris terkunci, dan `setAppraisalCalibrated`; `calculateAndSaveGPA` selalu `upsertPerformanceAppraisal(db, data, true)` lalu mengembalikan hasil upsert.
- `appraisalRepository`: hapus fungsi `setAppraisalCalibrated`; hapus `isCalibrated` dari `formatAppraisal` HANYA bila tidak ada konsumen lain (cek dengan grep; bila masih dipakai, biarkan sebagai `false`).
- `calculate-gpa/route.ts`: hapus `approve` dan `calibration_notes` dari skema zod serta dari pemanggilan service.
- `rbac.ts`: hapus permission `appraisal:calibrate` dari tipe dan matriks.
- UI `ninebox-matrix/page.tsx`: hapus tombol "Kalibrasi Penilaian", kartu aksi "Kalibrasi Penilaian", modal "Rapat Kalibrasi Penilaian", dan state `isCalibrateModalOpen`/`calibForm`/`isCalibrating`/`calibrateSuccessMsg`/`calibrateErrorMsg`/`calibrateModalError` beserta `handleSaveCalibration` dan `toggleHelp` yang hanya dipakai modal itu (pertahankan `showHelp` untuk grid).
- `manager-cockpit/page.tsx`: hapus baris `approve: false,`.
- Seed: semua `performance_appraisals` memakai `is_calibrated = FALSE`, `calibrated_by`/`calibrated_at`/`calibration_notes` NULL.
- Hapus `tests/integration/appraisalCalibrate.test.ts` dan `tests/ui/ninebox-calibrate-flow.test.tsx`; sesuaikan `tests/integration/gpaCalibrateGuard.test.ts` (tetap dipertahankan untuk perilaku simpan, bukan kunci).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/gpaNoLock.test.ts`
Expected: PASS (3 tes)

- [ ] **Step 5: Regresi area appraisal & 9-Box**

Run: `npx vitest run tests/integration tests/ui`
Expected: PASS seluruhnya.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(appraisal): hapus kalibrasi penilaian & penguncian nilai"
```

---

### Task 3 (c): Hapus modul audit

**Files:**
- Delete: `src/app/dashboard/audit-governance/page.tsx`, `src/app/api/v1/governance/audit-logs/route.ts`, `src/app/api/v1/audit/integrity/route.ts`, `tests/api/audit-integrity.test.ts`
- Modify: `src/middleware.ts`, `src/components/navigation/NavMenu.tsx`, `src/lib/services/auditRepository.ts` (atau `auditRepository`), `tests/api/routes.test.ts`, `tests/api/audit-coverage.test.ts`
- Test: `tests/unit/noAuditModule.test.ts` (create)

**Interfaces:**
- Consumes: `insertAuditLog` dari Task 1 (tetap ada).
- Produces: tidak ada ekspor baru. `verifyAuditChain` dihapus.

- [ ] **Step 1: Write the failing test**

`tests/unit/noAuditModule.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const p = (rel: string) => resolve(root, rel);

describe('modul audit dihapus', () => {
  it('halaman & endpoint audit tidak ada lagi', () => {
    expect(existsSync(p('src/app/dashboard/audit-governance/page.tsx'))).toBe(false);
    expect(existsSync(p('src/app/api/v1/governance/audit-logs/route.ts'))).toBe(false);
    expect(existsSync(p('src/app/api/v1/audit/integrity/route.ts'))).toBe(false);
  });

  it('middleware tidak lagi memetakan audit-governance', () => {
    const mw = readFileSync(p('src/middleware.ts'), 'utf8');
    expect(mw).not.toContain('audit-governance');
  });

  it('insertAuditLog tetap ada (dipakai login/profil)', () => {
    expect(existsSync(p('src/lib/services/auditService.ts'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/noAuditModule.test.ts`
Expected: FAIL — berkas audit masih ada.

- [ ] **Step 3: Hapus modul audit**

- Hapus keempat berkas di kolom Delete.
- `middleware.ts`: hapus segmen `'audit-governance'` dari `DASHBOARD_ROLES`.
- `NavMenu.tsx`: hapus butir "GCG Audit & Compliance".
- Hentikan penulisan hash chain: hapus `verifyAuditChain` dan perhitungan `entry_hash`/`prev_hash` di `insertAuditLog` (tetap menulis baris audit).
- Sesuaikan `tests/api/routes.test.ts` dan `tests/api/audit-coverage.test.ts` yang memanggil endpoint terhapus.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/noAuditModule.test.ts`
Expected: PASS (3 tes)

- [ ] **Step 5: Regresi**

Run: `npx vitest run tests/api tests/integration`
Expected: PASS seluruhnya.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(audit): hapus halaman & endpoint pemeriksaan audit"
```

---

### Task 4 (d): Super Admin hanya panel akun

**Files:**
- Modify: `src/middleware.ts`, `src/components/navigation/NavMenu.tsx`
- Test: `tests/unit/superAdminHome.test.ts` (create)

**Interfaces:**
- Consumes: `ROLE_LIST` dari Task 1.
- Produces: `homeForRole('SUPER_ADMIN')` → `/dashboard/account-management`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const mw = readFileSync(resolve(process.cwd(), 'src/middleware.ts'), 'utf8');
const nav = readFileSync(resolve(process.cwd(), 'src/components/navigation/NavMenu.tsx'), 'utf8');

describe('super admin hanya panel akun', () => {
  it('beranda super admin adalah panel akun', () => {
    // blok homeForRole memetakan SUPER_ADMIN ke account-management
    expect(mw).toMatch(/case 'SUPER_ADMIN':[\s\S]{0,80}account-management/);
  });

  it('menu super admin hanya Manajemen Akun', () => {
    const barisSuperAdmin = nav.split('\n').filter((l) => l.includes("'SUPER_ADMIN'") && l.includes('name:'));
    expect(barisSuperAdmin).toHaveLength(1);
    expect(barisSuperAdmin[0]).toContain('Manajemen Akun');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/superAdminHome.test.ts`
Expected: FAIL — SUPER_ADMIN masih diarahkan ke `/dashboard/executive` dan masih muncul di banyak menu.

- [ ] **Step 3: Khususkan Super Admin**

- `middleware.ts`: `homeForRole` memberi `SUPER_ADMIN` → `/dashboard/account-management` (pisahkan dari `case 'BOD'`). Tambahkan: pada segmen dashboard selain `account-management`, bila `session.role === 'SUPER_ADMIN'`, alihkan ke `/dashboard/account-management`.
- `NavMenu.tsx`: hapus `'SUPER_ADMIN'` dari daftar `roles` semua menu kecuali "Manajemen Akun".
- **Jangan** ubah matriks RBAC: SUPER_ADMIN tetap punya semua permission.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/superAdminHome.test.ts`
Expected: PASS (2 tes)

- [ ] **Step 5: Regresi**

Run: `npx vitest run tests/unit/rbac.test.ts tests/unit/middleware.test.ts tests/integration/accountManagement.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(auth): super admin hanya melihat panel manajemen akun"
```

---

### Task 5 (e): Menu datar

**Files:**
- Modify: `src/components/navigation/NavMenu.tsx`
- Test: `tests/ui/nav-flat.test.tsx` (create)

**Interfaces:**
- Consumes: daftar menu hasil Task 1–4.
- Produces: satu array `NAV_ITEMS` berisi semua butir menu datar (tanpa grup).

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import NavMenu from '@/components/navigation/NavMenu';

const ctx = (role: string) => ({ user: { role, name: 'X', email: 'x@x.id' }, isLoading: false } as any);

describe('menu datar', () => {
  it('tidak ada label grup Portals / Modul & Tata Kelola untuk HR', () => {
    render(<NavMenu />);
    expect(screen.queryByText(/^Portals$/i)).toBeNull();
    expect(screen.queryByText(/Modul & Tata Kelola/i)).toBeNull();
  });
});
```

Sesuaikan cara menyuntik sesi dengan pola nyata di `NavMenu.tsx` (baca berkasnya dulu; bila memakai `useAuth`, bungkus dengan provider yang sudah ada di `tests/ui/`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/nav-flat.test.tsx`
Expected: FAIL — label grup masih ada.

- [ ] **Step 3: Ratakan menu**

Di `NavMenu.tsx`: gabungkan `CORE_PORTALS` dan `MODULES_GOVERNANCE` menjadi satu array `NAV_ITEMS` dengan urutan: Executive Boardroom, HR Ops Command Center, Manager Evaluation Cockpit, Employee Growth Portal, 9-Box Talent Matrix, Offboarding & Clearance, Manajemen Akun. Render sebagai deret tautan `flex flex-wrap`, tanpa tombol dropdown dan tanpa header grup. Saring per peran seperti sebelumnya.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/nav-flat.test.tsx`
Expected: PASS

- [ ] **Step 5: Regresi & verifikasi penuh**

Run: `npx vitest run`
Expected: seluruh suite PASS
Run: `npm run lint` → bersih
Run: `npx tsc --noEmit` → 0 error

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(nav): menu datar tanpa dropdown grup"
```

---

## Completion

- `npx vitest run` hijau seluruhnya
- `npm run lint` bersih
- `npx tsc --noEmit` 0 error
- `npm run db:reset` sukses; akun seed tinggal lima peran
- Di browser: login tiap peran, pastikan menu sesuai dan tidak ada halaman audit/kalibrasi
