# Penyederhanaan Navigasi Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bilah atas hanya memuat entri yang tidak duplikat — Employee Portal tetap terjangkau untuk peran yang membutuhkan, 9-Box dipindah ke tab Ringkasan, dan tombol Panduan ganda dihapus.

**Architecture:** Satu berkas (`NavMenu.tsx`) diubah menjadi daftar menu yang bergantung peran dengan entri Employee Portal khusus, label menu disembunyikan (ikon saja), tombol Panduan dihapus; ditambah satu tombol tautan di `HrOverviewAnalyticsPanel`. Middleware tidak diubah.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-11-09-sederhana-peran-design.md` (lanjutan; keputusan navigasi baru)

## Global Constraints

- Peran tetap lima: `SUPER_ADMIN`, `BOD`, `HR_MANAGER`, `PEOPLE_MANAGER`, `EMPLOYEE`.
- **Employee Portal tidak dihapus untuk Employee** — itu satu-satunya dashboard mereka.
- Employee Portal **dihapus dari bilah atas hanya untuk HR_MANAGER dan BOD** (mereka membukanya lewat dashboard-nya sendiri).
- Employee Portal **tidak** ditambahkan untuk SUPER_ADMIN: middleware mengalihkannya dari semua segmen selain `account-management`, jadi menu itu akan jadi tautan mati.
- Tautan "Buka Matriks 9-Box" ditambahkan di tab Ringkasan (`HrOverviewAnalyticsPanel`), hanya untuk peran yang boleh membuka `/dashboard/ninebox-matrix`.
- Label menu memakai ikon saja (tanpa `<span className="hidden xl:inline">`); `title` wajib dipertahankan agar tetap ada teks alternatif.
- Tombol "Panduan" di `NavMenu` dihapus (duplikat: "Panduan Aplikasi" + ikon Panduan Pengguna sudah ada di `Header`).
- Tidak mengubah middleware, RBAC, atau rute.

## Review Focus

1. **Employee tidak kehilangan akses** — bilah atasnya tetap memuat Employee Portal. Uji di Task 1.
2. **HR/BOD tidak lagi melihat Employee Portal** di bilah atas. Uji di Task 1.
3. **SUPER_ADMIN tidak mendapat tautan mati** — menu hanya Manajemen Akun. Uji di Task 1.
4. **Label menu hilang tetapi aksesibilitas terjaga** — tiap tautan punya `title`/`aria-label`. Uji di Task 1.
5. **Tautan 9-Box hanya untuk peran berhak** dan mengarah ke `/dashboard/ninebox-matrix`. Uji di Task 2.

**Urutan wajib Task 1 → Task 2.**

---

### Task 1: NavMenu — entri per peran, ikon saja, tanpa Panduan

**Files:**
- Modify: `src/components/navigation/NavMenu.tsx`
- Test: `tests/ui/nav-roles.test.tsx` (create)

**Interfaces:**
- Consumes: `useAuth()` → `{ activeRole }`, `usePathname()`.
- Produces: tidak ada ekspor baru. Daftar menu tetap `NavItem[]`.

- [ ] **Step 1: Write the failing test**

`tests/ui/nav-roles.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const roleRef = { current: 'HR_MANAGER' };
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard/hr-command' }));
vi.mock('@/lib/context/AuthContext', () => ({
  useAuth: () => ({ activeRole: roleRef.current }),
}));

import NavMenu from '@/components/navigation/NavMenu';

const renderFor = (role: string) => {
  roleRef.current = role;
  return render(<NavMenu />);
};

afterEach(() => cleanup());

describe('menu per peran', () => {
  it('Employee melihat Employee Portal (satu-satunya dashboard-nya)', () => {
    renderFor('EMPLOYEE');
    expect(screen.getByRole('link', { name: /Employee Growth Portal/i })).toBeTruthy();
  });

  it('HR tidak melihat Employee Portal di bilah atas', () => {
    renderFor('HR_MANAGER');
    expect(screen.queryByRole('link', { name: /Employee Growth Portal/i })).toBeNull();
    expect(screen.getByRole('link', { name: /HR Ops Command Center/i })).toBeTruthy();
  });

  it('BOD tidak melihat Employee Portal dan tidak melihat 9-Box', () => {
    renderFor('BOD');
    expect(screen.queryByRole('link', { name: /Employee Growth Portal/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /9-Box/i })).toBeNull();
  });

  it('SUPER_ADMIN hanya melihat Manajemen Akun (tanpa tautan mati)', () => {
    renderFor('SUPER_ADMIN');
    expect(screen.getByRole('link', { name: /Manajemen Akun/i })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Employee Growth Portal/i })).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('label menu tidak lagi memakai span tersembunyi, tetapi tetap punya nama aksesibel', () => {
    renderFor('HR_MANAGER');
    const link = screen.getByRole('link', { name: /HR Ops Command Center/i });
    expect(link.getAttribute('title')).toBe('HR Ops Command Center');
  });

  it('tombol Panduan tidak ada lagi di NavMenu', () => {
    renderFor('HR_MANAGER');
    expect(screen.queryByRole('button', { name: /^Panduan$/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/nav-roles.test.tsx`
Expected: FAIL — HR masih melihat Employee Portal; tombol Panduan masih ada.

- [ ] **Step 3: Ubah `NavMenu.tsx`**

- `NAV_ITEMS`: hapus butir `9-Box Talent Matrix`. Ubah `roles` pada butir yang tersisa:
  - `Executive Boardroom`: `['BOD']`
  - `HR Ops Command Center`: `['HR_MANAGER']` — khusus HR (baca & tulis). BOD memantau read-only, jalan masuknya lewat Offboarding & Clearance di bawah.
  - `Manager Evaluation Cockpit`: `['PEOPLE_MANAGER']`
  - `Offboarding & Clearance`: `['HR_MANAGER', 'BOD']` — agar BOD tetap punya jalan ke HR Command Center (RBAC-nya read-only untuk BOD).
  - `Manajemen Akun`: `['SUPER_ADMIN']`
- Tambahkan daftar terpisah untuk Employee Portal yang hanya tampil untuk `EMPLOYEE`:
  ```ts
  const EMPLOYEE_PORTAL_ITEM: NavItem = {
    name: 'Employee Growth Portal',
    href: '/dashboard/employee-portal',
    icon: UserCheck,
    roles: ['EMPLOYEE'],
  };
  ```
  dan sertakan pada render: `[...NAV_ITEMS, EMPLOYEE_PORTAL_ITEM].filter(...)`.
- `NavLink`: hapus `<span className="hidden xl:inline">{item.name}</span>`; pertahankan `title={item.name}` dan tambahkan `aria-label={item.name}`.
- Hapus seluruh blok `<button ... setIsGuideOpen(true) ...>…Panduan…</button>` beserta state `isGuideOpen`, `setIsGuideOpen`, dan `<UserGuideModal .../>`. Hapus impor `BookOpen` dan `UserGuideModal` bila tidak terpakai.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/nav-roles.test.tsx`
Expected: PASS (6 tes)

- [ ] **Step 5: Commit**

```bash
git add src/components/navigation/NavMenu.tsx tests/ui/nav-roles.test.tsx
git commit -m "feat(nav): menu per peran tanpa duplikasi & tanpa tombol Panduan ganda"
```

---

### Task 2: Tautan "Buka Matriks 9-Box" di tab Ringkasan

**Files:**
- Modify: `src/components/governance/HrOverviewAnalyticsPanel.tsx:230-235`
- Test: `tests/ui/hr-overview-ninebox-link.test.tsx` (create)

**Interfaces:**
- Consumes: `useAuth()` dari `@/lib/context/AuthContext` untuk menentukan peran.
- Produces: tautan `href="/dashboard/ninebox-matrix"` berlabel `Buka Matriks 9-Box`.

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
it('menampilkan tautan Buka Matriks 9-Box untuk HR', async () => {
  render(<HrOverviewAnalyticsPanel />);
  const link = await screen.findByRole('link', { name: /Buka Matriks 9-Box/i });
  expect(link.getAttribute('href')).toBe('/dashboard/ninebox-matrix');
});
it('tidak menampilkan tautan untuk peran tanpa akses 9-Box', async () => {
  // role EMPLOYEE
  render(<HrOverviewAnalyticsPanel />);
  await waitFor(() => expect(screen.queryByRole('link', { name: /Buka Matriks 9-Box/i })).toBeNull());
});
```

Bungkus dengan mock `useAuth` dan `fetch` seperti `tests/ui/ninebox-guidance.test.tsx` (baca berkas itu untuk polanya).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/hr-overview-ninebox-link.test.tsx`
Expected: FAIL — tautan belum ada.

- [ ] **Step 3: Tambahkan tautan**

Di `HrOverviewAnalyticsPanel.tsx`, pada kartu "Matriks Talenta 9-Box" (sekitar L230-235), di bawah komponen `<NineBoxGrid />` tambahkan:

```tsx
{['BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'SUPER_ADMIN'].includes(role) && (
  <Link href="/dashboard/ninebox-matrix" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#007a5a] hover:underline">
    Buka Matriks 9-Box <ArrowRight className="h-3.5 w-3.5" />
  </Link>
)}
```

`role` diambil dari `useAuth()`; tambahkan impor `Link` dari `next/link` dan `ArrowRight` dari `lucide-react`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/hr-overview-ninebox-link.test.tsx`
Expected: PASS (2 tes)

- [ ] **Step 5: Regresi & verifikasi**

Run: `npx vitest run`
Expected: seluruh suite PASS
Run: `npx tsc --noEmit` → 0 error; `npm run lint` → bersih

- [ ] **Step 6: Commit**

```bash
git add src/components/governance/HrOverviewAnalyticsPanel.tsx tests/ui/hr-overview-ninebox-link.test.tsx
git commit -m "feat(hr-overview): tautan Buka Matriks 9-Box di tab Ringkasan"
```

---

## Completion

- `npx vitest run`, `npm run lint`, `npx tsc --noEmit` bersih
- Verifikasi browser per peran: Employee melihat Employee Portal; HR/BOD tidak; SUPER_ADMIN hanya Manajemen Akun; tautan 9-Box bekerja di tab Ringkasan HR
