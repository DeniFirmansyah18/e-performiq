# Perbaikan Tombol "Sahkan Kalibrasi" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tombol kalibrasi di halaman 9-Box benar-benar mengunci nilai lewat endpoint kalibrasi yang sah, dan peran yang tidak berhak mendapat penolakan eksplisit — bukan kunci palsu.

**Architecture:** Endpoint `PUT /api/v1/performance/appraisals/:id/calibrate` sudah ada dan benar, tetapi tidak pernah dipanggil UI. UI justru memanggil `POST /calculate-gpa`, yang hanya mengunci bila pemanggil punya `appraisal:calibrate` dan untuk peran lain menyimpan diam-diam. Perbaikan: `calculate-gpa` berhenti menyimpan untuk peran tanpa izin, dan UI memakai endpoint kalibrasi yang sesungguhnya.

**Tech Stack:** Next.js 14 App Router, TypeScript, Drizzle ORM di atas PGlite/PostgreSQL, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-09-kalibrasi-lock-design.md` — ditulis di Task 4; desain disetujui di percakapan.

## Global Constraints

- Nama internal `FUTURE_LEADER`, `quadrantKey`, dan `nine_box_quadrant` **tidak berubah**; terjemahan hanya di lapisan tampilan.
- Izin `appraisal:calibrate` tetap milik `SUPER_ADMIN`, `HR_MANAGER`, `BOD`. **Jangan** menambahkan `PEOPLE_MANAGER` (keputusan pemilik produk: alur dua tahap adalah pekerjaan terpisah).
- Nilai yang sudah `is_calibrated = TRUE` hanya boleh berubah lewat `unlock_appraisal()`.
- Semua respons route memakai `ok(...)` / `problem(...)` dari `src/lib/api/response.ts`.
- Uji yang menyentuh DB memakai `createTestDb()` + `runSeed()` dari `tests/setup.ts`.
- Jalankan vitest per berkas saat mengembangkan (suite penuh ±9 menit, `fileParallelism: false`).

## Review Focus

1. **UI tidak mengaku berhasil saat server menolak** — pesan galat tampil, pesan sukses tidak. Uji di Task 1.
2. **`calculate-gpa` oleh `PEOPLE_MANAGER` untuk appraisal yang BELUM terkunci** — harus 403 dan **tidak menyimpan apa pun**. Uji di Task 2.
3. **`calculate-gpa` oleh `PEOPLE_MANAGER`** — nilai & status kunci sebelum/sesudah percobaan wajib identik. Uji di Task 2.
4. **`PUT .../calibrate` oleh peran tanpa izin** — 403, bukan 401/500. Uji di Task 3.
5. **Kalibrasi ulang baris yang sudah terkunci** — 409 dan nilai lama utuh. Uji di Task 3.

**Urutan wajib Task 1 → 2 → 3 → 4.** Task 1 memperbaiki UI. Task 2 mengubah kontrak `calculateAndSaveGPA`, sehingga Task 1 harus mendahului agar UI sudah menampilkan galat dengan benar ketika penolakan mulai terjadi.

---

### Task 1: UI tidak mengaku berhasil saat server menolak

**Files:**
- Modify: `src/app/dashboard/ninebox-matrix/page.tsx:251-281` (`handleSaveCalibration`), dan render alert di sekitar `:362`
- Test: `tests/ui/ninebox-calibrate-flow.test.tsx` (create)

**Interfaces:**
- Consumes: `POST /api/v1/performance/appraisals/calculate-gpa` → `{ status:'success', data:{ appraisal_id, is_calibrated, composite_gpa, nine_box_placement:{ quadrant } } }`, atau galat `{ status:'error', code, detail }`.
- Produces: tidak ada ekspor baru.

**Latar:** saat ini `handleSaveCalibration` mengabaikan respons non-OK (hanya `if (res.ok)`), sehingga 403 dari server tampil sebagai "tidak terjadi apa-apa". Pesan sukses juga tidak pernah menampilkan status kunci sebenarnya.

- [ ] **Step 1: Write the failing test**

Buat `tests/ui/ninebox-calibrate-flow.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

import NineBoxMatrixPage from '@/app/dashboard/ninebox-matrix/page';

function stubFetch(gpaStatus: number) {
  global.fetch = vi.fn(async (input: any) => {
    const url = String(input);
    if (url.includes('/calculate-gpa')) {
      if (gpaStatus >= 400) {
        return { ok: false, status: gpaStatus, json: async () => ({ status: 'error', code: 'FORBIDDEN',
          detail: "Peran 'PEOPLE_MANAGER' tidak memiliki otorisasi 'appraisal:calibrate' untuk menyimpan hasil penilaian." }) };
      }
      return { ok: true, status: 200, json: async () => ({ status: 'success', data: {
        appraisal_id: '40000000-0000-4000-8000-000000000009',
        is_calibrated: true, composite_gpa: 3.6,
        nine_box_placement: { quadrant: 'HIGH_IMPACT' } } }) };
    }
    return { ok: true, status: 200, json: async () => ({ status: 'success', data: { total: 3, byQuadrant: {} } }) };
  }) as any;
}

async function submitCalibration() {
  render(<NineBoxMatrixPage />);
  fireEvent.click(screen.getByRole('button', { name: /Kalibrasi/i }));
  fireEvent.click(await screen.findByRole('button', { name: /Sahkan Kalibrasi/i }));
}

describe('alur kalibrasi 9-Box', () => {
  beforeEach(() => { stubFetch(200); });

  it('menampilkan pesan galat dan TIDAK mengaku berhasil saat server menolak (403)', async () => {
    stubFetch(403);
    await submitCalibration();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/tidak memiliki otorisasi/i));
    expect(screen.queryByText(/berhasil/i)).toBeNull();
  });

  it('menampilkan pesan sukses yang menyebut nilai sudah terkunci saat server menerima', async () => {
    await submitCalibration();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/terkunci/i));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/ninebox-calibrate-flow.test.tsx`
Expected: FAIL — tidak ada elemen `role="alert"`.

- [ ] **Step 3: Implementasikan penanganan galat & pesan status di `handleSaveCalibration`**

Tambahkan state `calibrateErrorMsg: string | null`. Di awal fungsi, reset `calibrateErrorMsg` dan `calibrateSuccessMsg`. Setelah `await res.json()`:

- jika `!res.ok` → `setCalibrateErrorMsg(json?.detail ?? 'Kalibrasi gagal. Silakan coba lagi.')` lalu `return` (di dalam `try`, sebelum `finally`).
- jika `res.ok` → bandingkan `json.data.is_calibrated`: `true` → pesan *"...nilai telah disahkan dan terkunci."*; `false` → pesan *"...tersimpan tetapi BELUM terkunci."*

Render di dekat alert sukses yang sudah ada:

```tsx
{calibrateErrorMsg && (
  <div role="alert" className="p-3.5 rounded-xl bg-[#fce8e6] border border-[#f5c6c0] text-xs font-semibold text-[#c5221f] flex items-center justify-between shadow-xs">
    <span>{calibrateErrorMsg}</span>
    <button onClick={() => setCalibrateErrorMsg(null)} className="font-bold underline">Tutup</button>
  </div>
)}
```

Tambahkan pula `role="alert"` pada blok `calibrateSuccessMsg` yang sudah ada, agar tes kedua memakai selektor yang sama.

Catatan: `PUT /calibrate` **tidak** ditambahkan di UI. `calculate-gpa` sudah mengunci otomatis bagi pemegang izin, sehingga `calculate-gpa` + `calibrate` berurutan akan selalu berakhir 409 (dibuktikan oleh tes di Task 3). Endpoint `PUT` tetap dipakai sebagai jalur kalibrasi eksplisit dan diperkuat di Task 3.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/ninebox-calibrate-flow.test.tsx`
Expected: PASS (2 tes)

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/ninebox-matrix/page.tsx tests/ui/ninebox-calibrate-flow.test.tsx
git commit -m "fix(ninebox): tampilkan penolakan kalibrasi, jangan mengaku berhasil"
```

---

### Task 2: `calculate-gpa` berhenti menyimpan untuk peran tanpa izin kalibrasi

**Files:**
- Modify: `src/lib/services/appraisalService.ts:70-142` (`calculateAndSaveGPA`)
- Test: `tests/integration/gpaCalibrateGuard.test.ts` (create)

**Interfaces:**
- Consumes: `can(session.role, 'appraisal:calibrate')` — sudah diimpor.
- Produces: `calculateAndSaveGPA` tetap `(db, session, input) => Promise<FormattedAppraisal>`; kini melempar `ForbiddenError` bila peran tidak punya `appraisal:calibrate`.

**Latar:** `isAuthorizedCalibrator` hanya dipakai untuk `allowOverride` dan `setAppraisalCalibrated`. Bila `false`, fungsi tetap memanggil `upsertPerformanceAppraisal` dan menyimpan. (Trigger DB `trg_appraisal_immutable` memang tetap memblokir penimpaan baris terkunci — sudah dibuktikan lewat probe; GUC `allow_appraisal_update` kembali `off` setelah `finally`. Jadi masalahnya murni di lapisan otorisasi.)

- [ ] **Step 1: Write the failing test**

Buat `tests/integration/gpaCalibrateGuard.test.ts`. Salin pola helper `sess`/`ROLE_USER_IDS` dari `tests/integration/services.test.ts`. Constants: `SITI='b0000000-0000-4000-8000-000000000002'` (HR_MANAGER), `DANU='b0000000-0000-4000-8000-000000000003'` (PEOPLE_MANAGER), `ANISA='b0000000-0000-4000-8000-000000000007'` (bawahan Danu, tanpa appraisal ter-kalibrasi di seed), `PERIOD_ID='d0000000-0000-4000-8000-000000000001'`.

```ts
it('PEOPLE_MANAGER tidak dapat menyimpan hasil kalkulasi (403)', async () => {
  await expect(appraisalService.calculateAndSaveGPA(db, sess('PEOPLE_MANAGER', DANU), {
    periodId: PERIOD_ID, employeeId: ANISA, sopScore: 70, competencyScore: 70, coreValuesScore: 70,
  })).rejects.toBeInstanceOf(ForbiddenError);
});

it('percobaan PEOPLE_MANAGER tidak mengubah nilai maupun status kunci', async () => {
  const before = await appraisalService.getAppraisalByEmployee(db, ANISA, PERIOD_ID);
  const gpa = before?.compositeGPA ?? null;
  const locked = before?.isCalibrated ?? null;
  await appraisalService.calculateAndSaveGPA(db, sess('PEOPLE_MANAGER', DANU), {
    periodId: PERIOD_ID, employeeId: ANISA, sopScore: 10, competencyScore: 10, coreValuesScore: 10,
  }).catch(() => undefined);
  const after = await appraisalService.getAppraisalByEmployee(db, ANISA, PERIOD_ID);
  expect(after?.compositeGPA ?? null).toBe(gpa);
  expect(after?.isCalibrated ?? null).toBe(locked);
});

it('HR_MANAGER tetap dapat menghitung dan hasilnya terkunci', async () => {
  const saved = await appraisalService.calculateAndSaveGPA(db, sess('HR_MANAGER', SITI), {
    periodId: PERIOD_ID, employeeId: ANISA, sopScore: 80, competencyScore: 80, coreValuesScore: 80,
  });
  expect(saved.isCalibrated).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/gpaCalibrateGuard.test.ts`
Expected: FAIL pada tes pertama; tes kedua gagal karena nilai Anisa berubah.

- [ ] **Step 3: Tambahkan penjagaan di awal `calculateAndSaveGPA`**

Setelah `assertEmployeeVisible(scope, input.employeeId)` dan setelah blok pengecekan `existing?.isCalibrated`, tambahkan:

```ts
if (!isAuthorizedCalibrator) {
  throw new ForbiddenError(
    `Peran '${session.role}' tidak memiliki otorisasi 'appraisal:calibrate' untuk menyimpan hasil penilaian. ` +
    'Hasil kalkulasi tidak disimpan.'
  );
}
```

Lalu sederhanakan sisa fungsi: `upsertPerformanceAppraisal(db, data, true)` dan `setAppraisalCalibrated(...)` selalu dijalankan. Hapus cabang `if (isAuthorizedCalibrator)` yang tersisa dan variabel antara `finalSaved`; kembalikan hasil `setAppraisalCalibrated`.

Tambahkan `ForbiddenError` ke impor dari `@/lib/auth/errors` bila belum ada (saat ini yang diimpor: `NotFoundError`, `ImmutableRecordError`, `BusinessRuleError`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/gpaCalibrateGuard.test.ts`
Expected: PASS (3 tes)

- [ ] **Step 5: Jalankan regresi area appraisal**

Run: `npx vitest run tests/integration/services.test.ts tests/integration/gpaBatch.test.ts`
Expected: PASS. Tes "HR Manager dapat menghitung Composite GPA" (`services.test.ts:145`) menghitung **ANISA** dengan HR_MANAGER — tetap lulus. Tes 409 untuk Budi lewat `calibrateAppraisal` tidak terpengaruh. Bila ada yang gagal, **jangan** melonggarkan penjagaan; sesuaikan tesnya ke perilaku baru dan jelaskan alasannya di commit.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/appraisalService.ts tests/integration/gpaCalibrateGuard.test.ts
git commit -m "fix(appraisal): tolak penyimpanan kalkulasi tanpa izin kalibrasi"
```

---

### Task 3: `calibrateAppraisal` menegakkan row-level scope

**Files:**
- Modify: `src/lib/services/appraisalService.ts:144-176` (`calibrateAppraisal`)
- Test: `tests/integration/appraisalCalibrate.test.ts` (create)

**Interfaces:**
- Consumes: `resolveVisibleEmployeeIds(db, session)` dan `assertEmployeeVisible(scope, employeeId)` dari `@/lib/auth/scope` — sudah diimpor.
- Produces: `calibrateAppraisal` tetap `(db, session, appraisalId, notes?) => Promise<FormattedAppraisal>`.

**Latar:** `calculateAndSaveGPA` memanggil `assertEmployeeVisible`, tetapi `calibrateAppraisal` hanya memanggil `assertCan` tanpa memeriksa scope. Perbaikan ini bersifat **pertahanan berlapis**: saat ini semua pemegang `appraisal:calibrate` juga org-wide, sehingga tes yang membuktikannya tidak mungkin ditulis dengan peran yang ada. Yang bisa dikunci hari ini adalah penolakan izin dan perilaku 409.

- [ ] **Step 1: Write the failing test**

Buat `tests/integration/appraisalCalibrate.test.ts` (helper sama seperti Task 2):

```ts
it('HR_MANAGER mengunci appraisal yang dihitung PEOPLE_MANAGER (409-safe)', async () => {
  const appr = await appraisalService.getAppraisalByEmployee(db, ANISA, PERIOD_ID);
  if (appr?.isCalibrated) return; // sudah dikunci di Task 2 — karakterisasi
  const locked = await appraisalService.calibrateAppraisal(db, sess('HR_MANAGER', SITI), appr!.id, 'Kalibrasi triwulanan');
  expect(locked.isCalibrated).toBe(true);
});

it('menolak kalibrasi ulang baris yang sudah terkunci (409)', async () => {
  const appr = await appraisalService.getAppraisalByEmployee(db, ANISA, PERIOD_ID);
  await expect(
    appraisalService.calibrateAppraisal(db, sess('HR_MANAGER', SITI), appr!.id, 'Kalibrasi kedua'),
  ).rejects.toBeInstanceOf(ImmutableRecordError);
});

it('PEOPLE_MANAGER tanpa izin calibrate ditolak (403)', async () => {
  const appr = await appraisalService.getAppraisalByEmployee(db, ANISA, PERIOD_ID);
  await expect(
    appraisalService.calibrateAppraisal(db, sess('PEOPLE_MANAGER', DANU), appr!.id, 'via manager'),
  ).rejects.toBeInstanceOf(ForbiddenError);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/appraisalCalibrate.test.ts`
Expected: PASS sejak awal (karakterisasi). Tidak ada yang gagal — ini disengaja: tes mengunci perilaku yang sudah benar agar tidak rusak oleh perubahan Task 3.

- [ ] **Step 3: Tambahkan pemeriksaan scope di `calibrateAppraisal`**

Setelah blok `if (appraisal.isCalibrated) { throw ... }`, tambahkan:

```ts
const scope = await resolveVisibleEmployeeIds(db, session);
assertEmployeeVisible(scope, appraisal.employeeId);
```

Urutan ini penting: 409 (data terkunci) diperiksa lebih dulu, baru 403 (scope).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/appraisalCalibrate.test.ts`
Expected: PASS (3 tes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/appraisalService.ts tests/integration/appraisalCalibrate.test.ts
git commit -m "fix(appraisal): tegakkan row-level scope pada kalibrasi"
```

---

### Task 4: Catat keputusan & pekerjaan terpisah

**Files:**
- Create: `docs/superpowers/specs/2026-11-09-kalibrasi-lock-design.md`
- Modify: `README.md` (bagian "Follow-up keamanan", sekitar baris 247)

**Interfaces:** tidak ada ekspor.

- [ ] **Step 1: Tulis spec ringkas**

Isi: tujuan (tombol tidak boleh berbohong), non-tujuan (bukan perancangan ulang otorisasi), keputusan pemilik produk (izin `appraisal:calibrate` tidak diubah; alur dua tahap = pekerjaan terpisah), bukti probe GUC (tidak bocor — trigger tetap memblokir, GUC kembali `off`), dan daftar pekerjaan lanjutan (alur dua tahap: manajer mengusulkan, HR/BOD mengesahkan).

- [ ] **Step 2: Tambahkan butir follow-up di README**

Di bagian "Follow-up keamanan", tambahkan: *"**Alur kalibrasi dua tahap** belum ada — saat ini `PEOPLE_MANAGER` tidak dapat menyimpan hasil kalkulasi penilaian sama sekali (403), dan hanya `SUPER_ADMIN`/`HR_MANAGER`/`BOD` yang dapat mengesahkan. Lihat `docs/superpowers/specs/2026-11-09-kalibrasi-lock-design.md`."*

- [ ] **Step 3: Verify**

Run: `git status --short`
Expected: hanya dua berkas di atas yang berubah.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-11-09-kalibrasi-lock-design.md README.md
git commit -m "docs: catat keputusan kalibrasi & pekerjaan lanjutan dua tahap"
```

---

## Completion

- `npx vitest run` hijau seluruhnya
- `npm run lint` bersih
- `npx tsc --noEmit` 0 error
