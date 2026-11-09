# Halaman 9-Box untuk HRD Pemula Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** HRD pemula membuka halaman 9-Box dan langsung tahu, untuk tiap kotak, siapa isinya dan apa yang harus dilakukan — tanpa menerjemahkan istilah Inggris di kepalanya.

**Architecture:** Satu modul teks (`nineBoxLabels.ts`) menjadi satu-satunya sumber nama, kalimat, dan panduan kesembilan kotak. Ia dipakai oleh `NineBoxGrid`, halaman `ninebox-matrix`, dan `faqData` sehingga tiga sumber teks yang sekarang saling bertentangan menjadi satu. Nama internal (`FUTURE_LEADER`, `quadrantKey`) tidak berubah; terjemahan hanya di lapisan tampilan.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-11-09-ninebox-pemula-design.md`

## Global Constraints

- Nama internal `FUTURE_LEADER`, `GROWTH_STAR`, `ENIGMA`, `HIGH_IMPACT`, `CORE_PLAYER`, `DILEMMA`, `TRUSTED_PRO`, `EFFECTIVE_PRO`, `UNDERPERFORMER` **tidak berubah** di kode, API, atau DB.
- `gpa-engine.ts` **tidak disentuh**. Rumus dan ambang tidak berubah.
- Tidak ada migrasi DB. `nine_box_quadrant` tetap menyimpan kode huruf besar.
- Label slider potensi harus mengikuti ambang nyata: `< 3.0` → **Potensi rendah**, `3.0–3.9` → **Potensi sedang**, `≥ 4.0` → **Potensi tinggi**. Angka asli tetap terlihat.
- Penjelasan selalu tampil; kunci `localStorage` `epq:ninebox:showHelp`, default `true`.
- Bila data gagal dimuat, tampilkan **"Data belum tersedia"**. Angka cadangan `1240/42/180/12` dibuang.
- Bahasa penjelasan: Indonesia sehari-hari, tanpa jargon, dan **tidak mengasumsikan penyebab** (contoh terlarang: "pindahkan ke proyek lain" sebagai perintah).
- Uji UI: anotasi `// @vitest-environment jsdom` per berkas dan `cleanup()` di `afterEach` (pola `tests/ui/flight-risk-panel.test.tsx`).

## Review Focus

1. **Kode kotak tak dikenal dari API** (mis. `nine_box_quadrant` bernilai `NULL` atau string lama) — harus tampil sebagai kotak "tidak dikenali", tidak membuat halaman blank/crash. Uji di Task 1.
2. **Data gagal dimuat** — kartu ringkas dan grid menampilkan "Data belum tersedia", bukan angka demo. Uji di Task 3.
3. **Preferensi sembunyikan penjelasan** — kalimat singkat hilang tapi nama kotak dan jumlah orang tetap ada; dan nilainya bertahan setelah render ulang. Uji di Task 4.
4. **Nilai potensi tepat di batas** (2.9 / 3.0 / 3.9 / 4.0) — label harus mengikuti ambang engine. Uji di Task 2.
5. **Panduan di FAQ** tidak boleh memakai nama kotak yang berbeda dari grid (kasus nyata: FAQ menulis "Growth Leader" & "Core Backbone"). Uji di Task 5.

**Urutan wajib Task 1 → 2 → 3 → 4 → 5.** Task 2–5 mengonsumsi `nineBoxLabels.ts` dari Task 1.

---

### Task 1: Modul teks bersama `nineBoxLabels.ts`

**Files:**
- Create: `src/lib/employee/nineBoxLabels.ts`
- Test: `tests/unit/nineBoxLabels.test.ts`

**Interfaces:**
- Consumes: `NineBoxQuadrant` dari `@/types`.
- Produces:
  ```ts
  export interface NineBoxCopy {
    name: string;          // nama tampil, mis. 'Penggerak Inti'
    position: string;      // subteks posisi, mis. 'potensi sedang · kinerja sedang'
    short: string;         // satu kalimat awam, selalu tampil di kotak
    happening: string;     // "Sedang terjadi" — penjelasan saat kotak dibuka
    firstStep: string;     // "Langkah pertama"
    checkFirst: string;    // "Yang perlu dicek dulu"
    shortAction: string;   // label tombol di kotak, mis. 'Pertahankan'
  }
  export const NINE_BOX_COPY: Record<NineBoxQuadrant, NineBoxCopy>
  export function nineBoxCopy(code: string): NineBoxCopy
  export function nineBoxLabel(code: string): string
  export function potentialLabel(score: number): 'Potensi rendah' | 'Potensi sedang' | 'Potensi tinggi'
  ```

- [ ] **Step 1: Write the failing test**

`tests/unit/nineBoxLabels.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { NINE_BOX_COPY, nineBoxCopy, nineBoxLabel, potentialLabel } from '@/lib/employee/nineBoxLabels';

describe('nineBoxLabels', () => {
  it('setiap kode 9-box punya nama Indonesia, bukan istilah Inggris lama', () => {
    const banned = ['Enigma', 'Growth Star', 'Future Leader', 'High Impact', 'Core Player', 'Dilemma', 'Trusted Pro', 'Effective Pro', 'Underperformer'];
    for (const copy of Object.values(NINE_BOX_COPY)) {
      for (const b of banned) expect(copy.name).not.toContain(b);
    }
  });

  it('ENIGMA memakai nama posisional, bukan nama puitis', () => {
    expect(nineBoxLabel('ENIGMA')).toBe('Potensi Tinggi, Kinerja Rendah');
    expect(NINE_BOX_COPY.ENIGMA.position).toBe('potensi tinggi · kinerja rendah');
  });

  it('kode tak dikenal dikembalikan sebagai kotak tidak dikenali, bukan crash', () => {
    const copy = nineBoxCopy('SOMETHING_ELSE');
    expect(copy.name).toBe('Kotak tidak dikenali');
    expect(copy.short.length).toBeGreaterThan(0);
  });

  it('label potensi mengikuti ambang engine (3.0 dan 4.0)', () => {
    expect(potentialLabel(2.9)).toBe('Potensi rendah');
    expect(potentialLabel(3.0)).toBe('Potensi sedang');
    expect(potentialLabel(3.9)).toBe('Potensi sedang');
    expect(potentialLabel(4.0)).toBe('Potensi tinggi');
    expect(potentialLabel(5.0)).toBe('Potensi tinggi');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/nineBoxLabels.test.ts`
Expected: FAIL — `Cannot find module '@/lib/employee/nineBoxLabels'`

- [ ] **Step 3: Implement `src/lib/employee/nineBoxLabels.ts`**

Isi `NINE_BOX_COPY` untuk 9 kode dengan nilai berikut (nama & posisi **persis** sesuai spec §6):

| Kode | name | position |
|---|---|---|
| `FUTURE_LEADER` | Pemimpin Masa Depan | potensi tinggi · kinerja tinggi |
| `GROWTH_STAR` | Bintang Berkembang | potensi tinggi · kinerja sedang |
| `ENIGMA` | Potensi Tinggi, Kinerja Rendah | potensi tinggi · kinerja rendah |
| `HIGH_IMPACT` | Pakar Berdampak | potensi sedang · kinerja tinggi |
| `CORE_PLAYER` | Penggerak Inti | potensi sedang · kinerja sedang |
| `DILEMMA` | Perlu Penyesuaian | potensi sedang · kinerja rendah |
| `TRUSTED_PRO` | Profesional Andalan | potensi rendah · kinerja tinggi |
| `EFFECTIVE_PRO` | Kontributor Terampil | potensi rendah · kinerja sedang |
| `UNDERPERFORMER` | Perlu Pembinaan | potensi rendah · kinerja rendah |

`ENIGMA.happening/firstStep/checkFirst` **persis** seperti spec §7. Sembilan kotak lainnya mengikuti pola dan nada yang sama, ditulis di langkah ini oleh pelaksana (spec §9 menyerahkannya ke pelaksana): `short` maksimal ~90 karakter, `happening` menjelaskan tanpa menyalahkan orangnya, `firstStep` satu tindakan, `checkFirst` berupa pertanyaan pemandu. `shortAction` adalah label tombol: `Pemimpin Masa Depan` → `Siapkan promosi`, `Perlu Pembinaan` → `Buat rencana pembinaan`, dst.

`nineBoxCopy` mengembalikan `NINE_BOX_COPY[code]` bila ada, selain itu objek fallback `{ name: 'Kotak tidak dikenali', position: 'posisi tidak diketahui', short: 'Data kotak ini tidak dikenali sistem.', happening: '...', firstStep: '...', checkFirst: '...', shortAction: 'Tinjau data' }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/nineBoxLabels.test.ts`
Expected: PASS (4 tes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/employee/nineBoxLabels.ts tests/unit/nineBoxLabels.test.ts
git commit -m "feat(ninebox): modul teks bersama untuk nama & panduan 9 kotak"
```

---

### Task 2: `NineBoxGrid` memakai teks bersama

**Files:**
- Modify: `src/components/charts/NineBoxGrid.tsx:59-132` (hapus `quadrantDefs` lokal)
- Test: `tests/ui/ninebox-grid-labels.test.tsx` (create)

**Interfaces:**
- Consumes: `nineBoxCopy`, `NINE_BOX_COPY` dari Task 1.
- Produces: `NineBoxGrid` tetap `({ employees }: { employees?: any[] })`; teks kotak kini dari modul bersama.

- [ ] **Step 1: Write the failing test**

`tests/ui/ninebox-grid-labels.test.tsx` — stub `global.fetch` untuk `/analytics/nine-box-distribution` mengembalikan `tidak bisa` (tolak), lalu render tanpa prop.

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import NineBoxGrid from '@/components/charts/NineBoxGrid';

afterEach(() => cleanup());

describe('NineBoxGrid label', () => {
  it('memakai nama kotak Bahasa Indonesia, bukan istilah Inggris lama', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as any;
    render(<NineBoxGrid />);
    expect(await screen.findByText('Penggerak Inti')).toBeTruthy();
    expect(screen.getByText('Potensi Tinggi, Kinerja Rendah')).toBeTruthy();
    expect(screen.queryByText(/Enigma/)).toBeNull();
    expect(screen.queryByText(/Core Player/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/ninebox-grid-labels.test.tsx`
Expected: FAIL — `Unable to find an element with the text: Penggerak Inti` (komponen masih memakai nama Inggris).

- [ ] **Step 3: Ganti `quadrantDefs` dengan modul bersama**

Di `NineBoxGrid.tsx`: hapus `interface QuadrantInfo` dan objek `quadrantDefs` (baris ~59-132). Render nama dari `nineBoxCopy(quad).name`, subteks dari `.position`, dan kalimat dari `.short`. Pertahankan warna latar/border/text per kotak dengan peta warna terpisah `QUADRANT_COLORS: Record<NineBoxQuadrant, { bg, border, text }>` berisi kelas yang **sama persis** dengan nilai `badgeBg/badgeBorder/badgeText` sekarang, agar tampilan visual tidak berubah.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/ninebox-grid-labels.test.tsx tests/ui/hr-command-narasi3.test.tsx`
Expected: PASS — kedua berkas lulus (hr-command memakai `NineBoxGrid` lewat `HrOverviewAnalyticsPanel`).

- [ ] **Step 5: Commit**

```bash
git add src/components/charts/NineBoxGrid.tsx tests/ui/ninebox-grid-labels.test.tsx
git commit -m "refactor(ninebox): NineBoxGrid memakai teks bersama"
```

---

### Task 3: Kartu ringkas & buang angka demo

**Files:**
- Modify: `src/app/dashboard/ninebox-matrix/page.tsx` (kartu metrik ~:370-520, fallback `?? 1240` dkk.)
- Test: `tests/ui/ninebox-summary-cards.test.tsx` (create)

**Interfaces:**
- Consumes: `GET /api/v1/performance/nine-box-summary` → `{ total, byQuadrant: Record<string, number> }`.
- Produces: tiga angka turunan — `perluPerhatian` = jumlah kotak 1–3 (`UNDERPERFORMER`+`EFFECTIVE_PRO`+`TRUSTED_PRO`), `siapPromosi` = kotak 7–9 (`ENIGMA`+`GROWTH_STAR`+`FUTURE_LEADER`), `perluDijaga` = kotak 4–6 (`DILEMMA`+`CORE_PLAYER`+`HIGH_IMPACT`).

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
// (mock next/navigation seperti tests/ui/ninebox-calibrate-flow.test.tsx)
it('menampilkan kartu ringkas dari data nyata', async () => {
  global.fetch = vi.fn(async (u: any) => {
    if (String(u).includes('nine-box-summary')) return { ok: true, status: 200, json: async () => ({
      status: 'success', data: { total: 6, byQuadrant: { UNDERPERFORMER: 1, ENIGMA: 2, FUTURE_LEADER: 3 } } }) };
    return { ok: true, status: 200, json: async () => ({ status: 'success', data: {} }) };
  }) as any;
  render(<NineBoxMatrixPage />);
  const perhatian = await screen.findByTestId('summary-perhatian');
  expect(perhatian.textContent).toContain('1');
  expect(screen.getByTestId('summary-promosi').textContent).toContain('5');
  expect(screen.getByTestId('summary-dijaga').textContent).toContain('0');
});

it('menampilkan "Data belum tersedia", bukan angka demo, saat API gagal', async () => {
  global.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as any;
  render(<NineBoxMatrixPage />);
  expect((await screen.findByTestId('summary-perhatian')).textContent).toContain('Data belum tersedia');
  expect(screen.queryByText('1.240')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/ninebox-summary-cards.test.tsx`
Expected: FAIL — `summary-perhatian` tidak ditemukan.

- [ ] **Step 3: Implementasikan kartu ringkas**

Tambahkan `data-testid` `summary-perhatian` / `summary-promosi` / `summary-dijaga`. Nilai dihitung dari `summary.byQuadrant` lewat pemetaan kotak di atas. Bila `summary === null`, ketiga kartu berisi **"Data belum tersedia"**. Hapus semua fallback demo `?? 1240`, `?? 42`, `?? 180`, `?? 12` beserta kartu metrik lama yang memakainya.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/ninebox-summary-cards.test.tsx tests/ui/ninebox-calibrate-flow.test.tsx`
Expected: PASS (3 tes lama + 2 tes baru)

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/ninebox-matrix/page.tsx tests/ui/ninebox-summary-cards.test.tsx
git commit -m "feat(ninebox): kartu ringkas pemula, buang angka demo"
```

---

### Task 4: Penjelasan di kotak + tombol sembunyikan + label slider

**Files:**
- Modify: `src/app/dashboard/ninebox-matrix/page.tsx` (modal detail kotak ~:700-740, modal kalibrasi ~:1085-1110)
- Test: `tests/ui/ninebox-guidance.test.tsx` (create)

**Interfaces:**
- Consumes: `nineBoxCopy(code)` dari Task 1 — `happening`, `firstStep`, `checkFirst`, `potentialLabel(score)`.
- Produces: tidak ada ekspor baru.

- [ ] **Step 1: Write the failing test**

```tsx
it('modal kotak menampilkan tiga bagian panduan', async () => {
  // buka kotak 'Penggerak Inti' lalu periksa ketiga judul bagian
  expect(await screen.findByText('Sedang terjadi')).toBeTruthy();
  expect(screen.getByText('Langkah pertama')).toBeTruthy();
  expect(screen.getByText('Yang perlu dicek dulu')).toBeTruthy();
});

it('tombol "Sembunyikan penjelasan" menyembunyikan kalimat singkat di grid', async () => {
  const before = screen.getAllByTestId('quad-short').length;
  expect(before).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: /Sembunyikan penjelasan/i }));
  expect(screen.queryAllByTestId('quad-short')).toHaveLength(0);
  // nama kotak tetap ada
  expect(screen.getByText('Penggerak Inti')).toBeTruthy();
  expect(localStorage.getItem('epq:ninebox:showHelp')).toBe('false');
});

it('label slider potensi mengikuti ambang', async () => {
  // buka modal kalibrasi, set potensi 2.9 / 4.0
  expect(screen.getByTestId('potential-label').textContent).toBe('Potensi rendah');
  // geser ke 4.0 -> 'Potensi tinggi'
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/ninebox-guidance.test.tsx`
Expected: FAIL — teks "Sedang terjadi" tidak ada.

- [ ] **Step 3: Implementasikan panduan, preferensi, dan label**

Modal detail kotak: tambahkan tiga blok berjudul **Sedang terjadi**, **Langkah pertama**, **Yang perlu dicek dulu** dari `nineBoxCopy`. Grid: beri `data-testid="quad-short"` pada kalimat singkat. Tombol **"Sembunyikan penjelasan"** mengubah state `showHelp` dan menulis `localStorage.setItem('epq:ninebox:showHelp', 'false')`; tombol berubah menjadi **"Tampilkan penjelasan"** saat nonaktif. Nilai awal dibaca dari `localStorage` (default `true`), dibaca di `useEffect` agar tidak melanggar SSR. Slider: tampilkan `data-testid="potential-label"` berisi `potentialLabel(value)`, angka asli tetap di sebelahnya.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/ninebox-guidance.test.tsx tests/ui/ninebox-summary-cards.test.tsx tests/ui/ninebox-calibrate-flow.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/ninebox-matrix/page.tsx tests/ui/ninebox-guidance.test.tsx
git commit -m "feat(ninebox): panduan pemula, tombol sembunyikan, label potensi"
```

---

### Task 5: Samakan panduan FAQ dengan grid

**Files:**
- Modify: `src/components/guide/faqData.ts:288-300` (daftar "Rincian dan Makna ke-9 Kuadran")
- Test: `tests/unit/faqNineBox.test.ts` (create)

**Interfaces:**
- Consumes: `NINE_BOX_COPY`, `nineBoxLabel` dari Task 1.
- Produces: tidak ada ekspor baru.

- [ ] **Step 1: Write the failing test**

```ts
import { FAQ_DATA } from '@/components/guide/faqData';
import { NINE_BOX_COPY } from '@/lib/employee/nineBoxLabels';

it('FAQ tidak memakai nama kotak yang berbeda dari grid', () => {
  const teks = JSON.stringify(FAQ_DATA);
  for (const lama of ['Growth Leader', 'Core Backbone', 'Future Leader', 'Trusted Pro', 'Effective Pro']) {
    expect(teks).not.toContain(lama);
  }
});

it('FAQ memuat kesembilan nama kotak dari modul bersama', () => {
  const teks = JSON.stringify(FAQ_DATA);
  for (const copy of Object.values(NINE_BOX_COPY)) {
    if (copy.name === 'Kotak tidak dikenali') continue;
    expect(teks).toContain(copy.name);
  }
});
```

Sesuai ekspor nyata `faqData.ts:46` — `export const FAQ_DATA: FaqItem[]`. Tidak perlu penyesuaian.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/faqNineBox.test.ts`
Expected: FAIL — berisi "Growth Leader" dan "Core Backbone".

- [ ] **Step 3: Tulis ulang daftar kotak di FAQ**

Ganti 9 butir "Rincian dan Makna ke-9 Kuadran" agar memakai `name` dan `short` dari `NINE_BOX_COPY` (impor modul, jangan salin manual), dan lengkapi istilah proses: Kalibrasi Penilaian, Rapat Kalibrasi, Catatan Alasan, Sebaran Nilai Wajib.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/faqNineBox.test.ts`
Expected: PASS (2 tes)

- [ ] **Step 5: Commit**

```bash
git add src/components/guide/faqData.ts tests/unit/faqNineBox.test.ts
git commit -m "docs(faq): samakan istilah 9-box dengan grid"
```

---

## Completion

- `npx vitest run` hijau seluruhnya
- `npm run lint` bersih
- `npx tsc --noEmit` 0 error
- Periksa manual di dev server: `/dashboard/ninebox-matrix` memuat tiga kartu ringkas, grid berbahasa Indonesia, dan tombol sembunyikan berfungsi.
