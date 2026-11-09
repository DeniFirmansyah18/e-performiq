# Bersihkan Tombol Palsu & Persentase Palsu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Halaman 9-Box berhenti menjanjikan aksi yang tidak terjadi, dan persentase tiap kotak dihitung dari data nyata alih-alih angka hardcoded.

**Architecture:** Satu berkas (`ninebox-matrix/page.tsx`) dirapikan dalam tiga langkah: hapus tombol yang tidak berfungsi, ganti satu tombol agar namanya sesuai perilaku nyata (memuat ulang data), lalu ganti `populationPct` hardcoded dengan hitungan dari `summary` yang sudah tersedia. Tidak ada perubahan API atau skema.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-11-09-ninebox-palsu-design.md`

## Global Constraints

- Tidak membuat fitur PDF laporan maupun simulasi talent pool — keduanya pekerjaan terpisah (spec §7).
- Tidak mengubah API, skema DB, atau rumus 9-Box.
- Tiga kartu ringkas (`summary-perhatian`, `summary-promosi`, `summary-dijaga`) tidak diubah.
- Persentase: `summary` kosong → **"—"**; `summary.total === 0` → **"—"** (bukan 0%, dan bukan pembagian nol).
- Format persentase seragam `x,x%` (satu desimal, koma desimal Indonesia) untuk kesembilan kotak; label istimewa "Top 3.4%" dihapus.
- Bahasa Indonesia, tanpa jargon.
- Tidak boleh ada teks rusak/mojibake (sudah dijaga `tests/unit/nineBoxTextQuality.test.ts`).
- Uji UI: anotasi `// @vitest-environment jsdom` + `cleanup()` di `afterEach`.

## Review Focus

1. **`summary` belum dimuat** — persentase mustahil menampilkan `0%` atau `NaN%`; harus "—". Uji di Task 3.
2. **Total karyawan nol** — pembagian nol tidak boleh menghasilkan `Infinity`/`NaN`. Uji di Task 3.
3. **Tidak ada `alert()` tersisa** di halaman 9-Box. Uji di Task 1.
4. **Tidak ada tombol tanpa fungsi** setelah penghapusan (tidak menyisakan tombol kosong/matikan). Uji di Task 1 & 2.
5. **Persentase konsisten dengan data** — jumlah persen ≈ 100 saat semua kotak terisi. Uji di Task 3.

**Urutan wajib Task 1 → 2 → 3.** Task 2 memakai `handleRunAi` yang tidak diubah Task 1; Task 3 independen tetapi menyentuh berkas yang sama.

---

### Task 1: Hapus tombol yang tidak melakukan apa pun

**Files:**
- Modify: `src/app/dashboard/ninebox-matrix/page.tsx` (tombol ~L380, ~L501, ~L785, ~L1016, ~L1053, ~L1090)
- Test: `tests/ui/ninebox-no-fake-actions.test.tsx` (create)

**Interfaces:**
- Consumes: —
- Produces: tidak ada ekspor baru.

- [ ] **Step 1: Write the failing test**

`tests/ui/ninebox-no-fake-actions.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/dashboard/ninebox-matrix',
}));
import NineBoxMatrixPage from '@/app/dashboard/ninebox-matrix/page';

afterEach(() => cleanup());

describe('tidak ada aksi palsu', () => {
  it('tidak ada tombol yang memanggil alert()', async () => {
    const spy = vi.fn();
    vi.stubGlobal('alert', spy);
    global.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as any;

    render(<NineBoxMatrixPage />);
    // Buka panel matriks agar tombol di dalamnya ikut dirender.
    const matriks = screen.getAllByRole('button', { name: /Matriks 9-Box/i })[0];
    fireEvent.click(matriks);
    await waitFor(() => expect(screen.getByText('Penggerak Inti')).toBeTruthy());

    for (const b of screen.getAllByRole('button')) fireEvent.click(b);
    await waitFor(() => expect(spy).not.toHaveBeenCalled());
  });

  it('tombol Download Matriks PDF dan audit dossier tidak ada lagi', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as any;
    render(<NineBoxMatrixPage />);
    expect(screen.queryByRole('button', { name: /Download Matriks PDF/i })).toBeNull();
    expect(screen.queryByTitle(/Buka detail kuadran lengkap/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/ninebox-no-fake-actions.test.tsx`
Expected: FAIL — `alert` terpanggil dan/atau tombol "Download Matriks PDF" masih ada.

- [ ] **Step 3: Hapus enam tombol**

Hapus elemen berikut (bentuk nyata sudah diverifikasi):
- **Header** (~L378-385): `<button>` biasa berisi `<Download/>` + `<span>Download Matriks PDF</span>` — hapus seluruh `<button>…</button>` beserta komentarnya.
- **Kartu aksi** (~L495-502): `<ActionCard icon={Download} tone="slate" title="Download Matriks PDF" … />` — hapus satu elemen `ActionCard` itu saja; kartu lain di grid yang sama tetap.
- **Ikon audit dossier** (~L785): tombol `title="Buka detail kuadran lengkap"` — hapus tombolnya saja; pembungkus header panel tetap.
- **Tabel suksesi** (~L1014-1021, ~L1051-1058, ~L1088-1095): hapus seluruh `<td>` yang isinya hanya tombol `MoreHorizontal` itu. Periksa `<thead>` tabel yang sama dan hapus juga sel header terakhir yang kosong, agar kolom tidak menyisakan judul tanpa isi.

Bersihkan impor ikon yang menjadi tak terpakai (`Download`, `ExternalLink`, `MoreHorizontal`) agar `tsc`/lint bersih.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/ninebox-no-fake-actions.test.tsx`
Expected: PASS (2 tes)

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/ninebox-matrix/page.tsx tests/ui/ninebox-no-fake-actions.test.tsx
git commit -m "fix(ninebox): hapus tombol yang hanya memanggil alert"
```

---

### Task 2: Ganti nama "Simulasi Talent Pool" menjadi "Muat ulang data"

**Files:**
- Modify: `src/app/dashboard/ninebox-matrix/page.tsx` (~L407, ~L485, ~L923 label; pesan sukses ~L941)
- Test: `tests/ui/ninebox-reload-button.test.tsx` (create)

**Interfaces:**
- Consumes: `handleRunAi` (sudah ada; hanya memanggil `GET /api/v1/performance/nine-box-summary` lalu `setSummary`).
- Produces: tidak ada ekspor baru.

**Latar:** `handleRunAi` tidak mensimulasikan apa pun — ia memuat ulang ringkasan yang sudah ada. Pesan suksesnya sekarang menampilkan angka karangan ("12 kursi terpetakan dengan rasio koverasi suksesi 3.2 : 1"), yang tipe kebohongannya sama dengan tombol yang dihapus di Task 1.

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
it('tombol bernama "Muat ulang data" memuat ulang ringkasan dan tidak mengarang angka', async () => {
  let calls = 0;
  global.fetch = vi.fn(async (u: any) => {
    if (String(u).includes('nine-box-summary')) {
      calls++;
      return { ok: true, status: 200, json: async () => ({ status: 'success', data: { total: 4, byQuadrant: { CORE_PLAYER: 4 } } }) };
    }
    return { ok: true, status: 200, json: async () => ({ status: 'success', data: {} }) };
  }) as any;

  render(<NineBoxMatrixPage />);
  fireEvent.click(screen.getAllByRole('button', { name: /Matriks 9-Box/i })[0]);
  await waitFor(() => expect(calls).toBeGreaterThan(0));

  const btn = await screen.findByRole('button', { name: /Muat ulang data/i });
  const before = calls;
  fireEvent.click(btn);
  await waitFor(() => expect(calls).toBeGreaterThan(before));

  const teks = document.body.textContent ?? '';
  expect(teks).not.toMatch(/Simulasi selesai/);
  expect(teks).not.toMatch(/3\.2\s*:/);
});

it('label lama "Simulasi Talent Pool" tidak ada lagi', async () => {
  global.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as any;
  render(<NineBoxMatrixPage />);
  fireEvent.click(screen.getAllByRole('button', { name: /Matriks 9-Box/i })[0]);
  expect(screen.queryByRole('button', { name: /Simulasi Talent Pool/i })).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/ninebox-reload-button.test.tsx`
Expected: FAIL — tombol "Muat ulang data" tidak ditemukan; teks "Simulasi selesai" ada.

- [ ] **Step 3: Ganti tiga label dan pesan sukses**

- Label tombol header (~L407): `Simulasi Talent Pool Suksesi` → `Muat ulang data`.
- `<ActionCard title="Simulasi Talent Pool" ...>` (~L482-485): `title` → `Muat ulang data`, `description` → `"Ambil ulang sebaran karyawan terbaru dari database."`.
- Tombol di panel (~L923): label tombol → `Muat ulang data`.
- Pesan sukses (~L941): ganti teksnya menjadi `Data 9-Box berhasil dimuat ulang.`
- Ganti nama state `aiSuccessMsg`/`isAiRunning` menjadi `reloadOk`/`isReloading` (dan label tombol saat memuat: `Memuat ulang...`) agar nama tidak menyesatkan. Ubah semua pemakaiannya di berkas yang sama.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/ninebox-reload-button.test.tsx tests/ui/ninebox-no-fake-actions.test.tsx`
Expected: PASS (4 tes)

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/ninebox-matrix/page.tsx tests/ui/ninebox-reload-button.test.tsx
git commit -m "fix(ninebox): 'Simulasi Talent Pool' menjadi 'Muat ulang data' sesuai perilakunya"
```

---

### Task 3: Persentase kotak dari data nyata

**Files:**
- Modify: `src/app/dashboard/ninebox-matrix/page.tsx` (`QuadrantData.populationPct` ~L64 dan 9 nilai ~L79-183; render ~L692-700)
- Test: `tests/ui/ninebox-box-percentages.test.tsx` (create)

**Interfaces:**
- Consumes: state `summary: { total: number; byQuadrant: Record<string, number> } | null` (sudah ada).
- Produces: fungsi lokal `boxPercent(code: string): string` di dalam komponen, mengembalikan mis. `"25,0%"` atau `"—"`.

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
it('persentase kotak dihitung dari data nyata', async () => {
  global.fetch = vi.fn(async (u: any) => {
    if (String(u).includes('nine-box-summary')) {
      return { ok: true, status: 200, json: async () => ({ status: 'success',
        data: { total: 4, byQuadrant: { CORE_PLAYER: 3, FUTURE_LEADER: 1 } } }) };
    }
    return { ok: true, status: 200, json: async () => ({ status: 'success', data: {} }) };
  }) as any;

  render(<NineBoxMatrixPage />);
  fireEvent.click(screen.getAllByRole('button', { name: /Matriks 9-Box/i })[0]);

  await waitFor(() => {
    expect(screen.getAllByTestId('box-percent').some((e) => e.textContent === '75,0%')).toBe(true);
  });
  const semua = screen.getAllByTestId('box-percent').map((e) => e.textContent);
  expect(semua).toContain('25,0%');
  expect(semua).toContain('0,0%');
  // Label istimewa lama sudah hilang
  expect(screen.queryByText(/Top 3\.4%/)).toBeNull();
});

it('saat data belum dimuat menampilkan "—", bukan 0% atau NaN', async () => {
  global.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as any;
  render(<NineBoxMatrixPage />);
  fireEvent.click(screen.getAllByRole('button', { name: /Matriks 9-Box/i })[0]);
  await waitFor(() => expect(screen.getAllByTestId('box-percent').length).toBe(9));
  for (const e of screen.getAllByTestId('box-percent')) {
    expect(['—']).toContain(e.textContent);
  }
});

it('total nol tidak menghasilkan NaN atau Infinity', async () => {
  global.fetch = vi.fn(async (u: any) => {
    if (String(u).includes('nine-box-summary')) {
      return { ok: true, status: 200, json: async () => ({ status: 'success', data: { total: 0, byQuadrant: {} } }) };
    }
    return { ok: true, status: 200, json: async () => ({ status: 'success', data: {} }) };
  }) as any;
  render(<NineBoxMatrixPage />);
  fireEvent.click(screen.getAllByRole('button', { name: /Matriks 9-Box/i })[0]);
  await waitFor(() => expect(screen.getAllByTestId('box-percent').length).toBe(9));
  const txt = document.body.textContent ?? '';
  expect(txt).not.toMatch(/NaN|Infinity/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/ninebox-box-percentages.test.tsx`
Expected: FAIL — `box-percent` tidak ditemukan.

- [ ] **Step 3: Implementasikan `boxPercent` dan hapus `populationPct`**

Hapus field `populationPct` dari `interface QuadrantData` dan kesembilan nilai literalnya. Di dalam komponen:

```ts
const boxPercent = (code: string): string => {
  if (!summary || !summary.total) return '—';
  const n = summary.byQuadrant?.[code] ?? 0;
  const pct = (n / summary.total) * 100;
  return `${pct.toFixed(1).replace('.', ',')}%`;
};
```

Pada render (~L692-700), ganti ketiga cabang yang mencetak `{quad.populationPct}` dengan satu elemen seragam:

```tsx
<span data-testid="box-percent" className={/* kelas warna sesuai isBox9/isBox1 seperti sekarang */}>
  {boxPercent(quad.quadrantKey)}
</span>
```

Pertahankan beda warna teks/badge per kotak (kotak 9 hijau, kotak 1 merah, lainnya abu) seperti sekarang.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/ninebox-box-percentages.test.tsx`
Expected: PASS (3 tes)

- [ ] **Step 5: Run regresi halaman 9-Box**

Run: `npx vitest run tests/ui`
Expected: PASS seluruhnya.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/ninebox-matrix/page.tsx tests/ui/ninebox-box-percentages.test.tsx
git commit -m "fix(ninebox): persentase tiap kotak dihitung dari data nyata"
```

---

## Completion

- `npx vitest run` hijau seluruhnya
- `npm run lint` bersih
- `npx tsc --noEmit` 0 error
- Periksa di browser: tidak ada tombol yang memunculkan `alert`, tombol "Muat ulang data" bekerja, persentase berubah bila data berubah
