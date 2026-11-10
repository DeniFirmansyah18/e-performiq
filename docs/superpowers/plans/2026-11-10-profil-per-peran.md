# Profil Saya per Peran Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Profil Saya menampilkan konteks kepegawaian (jabatan, departemen, atasan penilai, jumlah bawahan) sesuai peran, dan berhenti mengirim gaji pokok ke browser.

**Architecture:** `getMyProfile` menambah JOIN ke `departments`, `job_positions`, dan self-join `employees` (atasan), plus hitungan bawahan aktif. `baseSalary` dihapus dari SELECT dan tipe. `MyProfileModal` menambah blok "Kepegawaian" yang tampil bersyarat per peran lewat `useAuth()`.

**Tech Stack:** Next.js 14 App Router, Drizzle ORM over PGlite, Vitest + Testing Library, TypeScript.

**Spec:** `docs/superpowers/specs/2026-11-10-profil-per-peran-design.md`

## Global Constraints

- Peran: `SUPER_ADMIN`, `BOD`, `HR_MANAGER`, `PEOPLE_MANAGER`, `EMPLOYEE`.
- Hak sunting data pribadi **sama untuk semua peran** (keputusan pemilik produk).
- `PATCH /api/v1/profile/me` **tidak berubah** — field yang boleh disunting tetap `phone_number, address, date_of_birth, emergency_contact_name, emergency_contact_phone, photo_url, bio`.
- `baseSalary` **tidak boleh** dikirim ke klien dalam bentuk apa pun.
- BOD **tidak** menampilkan baris "Dinilai oleh".
- Bawahan dihitung dari `manager_id`; status aktif = `status IN ('PERMANENT','PROBATION','PKWT')`.
- Tidak mengubah RBAC, middleware, Kontrol Siklus 3-Fase, Manager Cockpit, HR Command Center.
- Menyunting jabatan/departemen dari profil **tidak** disediakan.

## Review Focus

1. **Peran tanpa bawahan** (`directReportCount` = 0) harus tetap tampil wajar, bukan "0 bawahan" yang membingungkan.
2. **Pegawai tanpa atasan** (BOD/CEO, `manager_id` NULL) tidak boleh menampilkan "Dinilai oleh -" kosong.
3. **Respons API lama/manpa field baru** (mock tes) tidak boleh membuat modal crash.
4. **`baseSalary`** tidak muncul di payload maupun di DOM, untuk peran apa pun.
5. **Tanggal masuk tidak valid/kosong** tidak boleh menghasilkan "masa kerja NaN tahun".

---

### Task 1: Perluas `getMyProfile` dengan konteks kepegawaian

**Files:**
- Modify: `src/lib/services/employeeProfileService.ts:19-32`
- Test: `tests/unit/employeeProfileService.test.ts` (create)

**Interfaces:**
- Consumes: `Db` dari `@/lib/db/client`.
- Produces: `getMyProfile(db, employeeId)` menghasilkan objek dengan field tambahan:
  `positionTitle: string | null`, `departmentName: string | null`,
  `managerName: string | null`, `managerCode: string | null`,
  `directReportCount: number`.
  `baseSalary` **tidak lagi** ada pada hasil.

- [ ] **Step 1: Write the failing test**

`tests/unit/employeeProfileService.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { getMyProfile } from '@/lib/services/employeeProfileService';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const DANU = 'b0000000-0000-4000-8000-000000000003';
const HENDRA = 'b0000000-0000-4000-8000-000000000001';

describe('getMyProfile — konteks kepegawaian', () => {
  let client: PGlite;
  let db: Db;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  }, 60000);

  afterAll(async () => { await client.close(); });

  it('menyertakan jabatan, departemen, dan atasan', async () => {
    const p = await getMyProfile(db, BUDI);
    expect(p.positionTitle).toBeTruthy();
    expect(p.departmentName).toBeTruthy();
    expect(p.managerName).toBe('Raden Mas Danu, S.T., M.Kom.');
  });

  it('menghitung bawahan langsung untuk People Manager', async () => {
    const p = await getMyProfile(db, DANU);
    expect(p.directReportCount).toBeGreaterThan(0);
  });

  it('tidak mengirim gaji pokok ke klien', async () => {
    const p = await getMyProfile(db, BUDI);
    expect('baseSalary' in p).toBe(false);
  });

  it('atasan NULL untuk CEO tidak membuat query gagal', async () => {
    const p = await getMyProfile(db, HENDRA);
    expect(p.managerName).toBeNull();
    expect(p.directReportCount).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/employeeProfileService.test.ts`
Expected: FAIL — `positionTitle` undefined dan `baseSalary` masih ada.

- [ ] **Step 3: Perluas `SELECT_PROFILE`**

Di `src/lib/services/employeeProfileService.ts`, ganti `SELECT_PROFILE` agar memakai JOIN, menghapus `base_salary`, dan menambah subquery hitungan bawahan:

```sql
SELECT e.id, e.employee_code AS "employeeCode", e.full_name AS "fullName", e.email,
       e.phone_number AS "phoneNumber", e.department_id AS "departmentId", e.position_id AS "positionId",
       e.status, e.join_date AS "joinDate",
       e.date_of_birth AS "dateOfBirth", e.address, e.emergency_contact_name AS "emergencyContactName",
       e.emergency_contact_phone AS "emergencyContactPhone", e.photo_url AS "photoUrl", e.bio,
       e.gender, e.nik,
       d.department_name AS "departmentName",
       jp.position_title AS "positionTitle",
       m.full_name AS "managerName",
       m.employee_code AS "managerCode",
       (SELECT COUNT(*)::int FROM employees c
         WHERE c.manager_id = e.id
           AND c.status IN ('PERMANENT','PROBATION','PKWT')) AS "directReportCount"
  FROM employees e
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN job_positions jp ON jp.id = e.position_id
  LEFT JOIN employees m ON m.id = e.manager_id
 WHERE e.id = ${employeeId}::uuid
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/employeeProfileService.test.ts`
Expected: PASS (4 tes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/employeeProfileService.ts tests/unit/employeeProfileService.test.ts
git commit -m "feat(profile): sertakan jabatan, departemen, atasan, dan bawahan; buang baseSalary"
```

---

### Task 2: Blok "Kepegawaian" bersyarat per peran di `MyProfileModal`

**Files:**
- Modify: `src/components/employee/MyProfileModal.tsx:8-15` (interface), `:118-128` (blok read-only)
- Test: `tests/ui/my-profile-roles.test.tsx` (create)

**Interfaces:**
- Consumes: `useAuth()` dari `@/lib/context/AuthContext` (`currentUser.role`); field dari Task 1.
- Produces: tidak ada ekspor baru. Komponen mengimpor `useOptionalAuth` agar aman tanpa provider.

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

const roleRef = { current: 'EMPLOYEE' };
vi.mock('@/lib/context/AuthContext', () => ({
  useAuth: () => ({ currentUser: { role: roleRef.current } }),
  useOptionalAuth: () => ({ currentUser: { role: roleRef.current } }),
}));

import MyProfileModal from '@/components/employee/MyProfileModal';

const profilDasar = {
  employeeCode: 'EMP-1', fullName: 'Budi', email: 'b@x.id', status: 'PERMANENT',
  nik: '123', gender: 'LAKI_LAKI', positionTitle: 'Engineer',
  departmentName: 'Engineering', managerName: 'Danu', managerCode: 'MGR-1',
  directReportCount: 0, joinDate: '2022-03-01',
};

const stub = (data: any) => {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ data }) })) as any;
};

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Profil Saya per peran', () => {
  it('Employee melihat jabatan & atasan, tanpa bawahan', async () => {
    stub(profilDasar);
    roleRef.current = 'EMPLOYEE';
    render(<MyProfileModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Kepegawaian')).toBeTruthy());
    expect(screen.getByText('Engineering')).toBeTruthy();
    expect(screen.getByText('Danu')).toBeTruthy();
    expect(screen.queryByText(/bawahan langsung/i)).toBeNull();
  });

  it('People Manager melihat jumlah bawahan', async () => {
    stub({ ...profilDasar, directReportCount: 5 });
    roleRef.current = 'PEOPLE_MANAGER';
    render(<MyProfileModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText(/5 bawahan langsung/i)).toBeTruthy());
  });

  it('BOD tidak melihat baris Dinilai oleh', async () => {
    stub({ ...profilDasar, managerName: null, directReportCount: 7 });
    roleRef.current = 'BOD';
    render(<MyProfileModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Kepegawaian')).toBeTruthy());
    expect(screen.queryByText(/Dinilai oleh/i)).toBeNull();
  });

  it('gaji pokok tidak pernah dirender', async () => {
    stub({ ...profilDasar, baseSalary: 99000000 });
    roleRef.current = 'HR_MANAGER';
    render(<MyProfileModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Kepegawaian')).toBeTruthy());
    expect(screen.queryByText(/gaji pokok/i)).toBeNull();
  });

  it('joinDate kosong tidak menghasilkan NaN', async () => {
    stub({ ...profilDasar, joinDate: null });
    roleRef.current = 'HR_MANAGER';
    render(<MyProfileModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Kepegawaian')).toBeTruthy());
    expect(document.body.textContent).not.toMatch(/NaN/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/my-profile-roles.test.tsx`
Expected: FAIL — teks "Kepegawaian" tidak ada.

- [ ] **Step 3: Implementasi blok Kepegawaian**

- Tambah ke `interface Profile`: `positionTitle?`, `departmentName?`, `managerName?`, `managerCode?`, `directReportCount?`, dan **hapus** `baseSalary`.
- Di komponen: `const role = useOptionalAuth()?.currentUser?.role;`
- Hitung masa kerja dengan aman: bila `joinDate` kosong/tidak valid → `'-'`. Format `"X tahun Y bulan"`; bila kurang dari 1 bulan → `"< 1 bulan"`.
- Render blok tepat setelah blok read-only identitas:

```tsx
<div className="p-3 rounded-xl bg-white border border-[#e2e8f0] space-y-1.5">
  <p className="text-xs font-bold text-[#0f172a]">Kepegawaian</p>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
    {/* Jabatan, Departemen, Tanggal Masuk, Masa Kerja */}
    {role !== 'BOD' && profile?.managerName && (
      {/* Dinilai oleh: nama + kode atasan */}
    )}
    {role !== 'EMPLOYEE' && (profile?.directReportCount ?? 0) > 0 && (
      <p>{profile.directReportCount} bawahan langsung</p>
    )}
  </div>
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/my-profile-roles.test.tsx`
Expected: PASS (5 tes)

- [ ] **Step 5: Verifikasi menyeluruh**

Run: `npx vitest run` → seluruh suite PASS
Run: `npx tsc --noEmit` → 0 error
Run: `npx next lint` → bersih

- [ ] **Step 6: Commit**

```bash
git add src/components/employee/MyProfileModal.tsx tests/ui/my-profile-roles.test.tsx
git commit -m "feat(profile): blok kepegawaian bersyarat per peran di Profil Saya"
```

---

## Completion

- Suite penuh, `tsc`, dan lint bersih.
- Verifikasi browser: Employee melihat jabatan+atasan; People Manager & HR melihat bawahan; BOD tanpa "Dinilai oleh"; gaji pokok tidak muncul di DOM/payload untuk peran mana pun.
