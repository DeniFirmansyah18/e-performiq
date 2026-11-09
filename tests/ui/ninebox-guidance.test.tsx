// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/dashboard/ninebox-matrix',
}));

import NineBoxMatrixPage from '@/app/dashboard/ninebox-matrix/page';
import { calculateCompositeGPA } from '@/lib/engines/gpa-engine';
import { nineBoxCopy } from '@/lib/employee/nineBoxLabels';

function stubFetch() {
  global.fetch = vi.fn(async (u: any) => {
    if (String(u).includes('nine-box-summary')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: 'success', data: { total: 3, byQuadrant: { CORE_PLAYER: 3 } } }),
      };
    }
    return { ok: true, status: 200, json: async () => ({ status: 'success', data: {} }) };
  }) as any;
}


// jsdom di environment ini tidak menyediakan localStorage pada window.
// Stub in-memory agar persistensi benar-benar teruji.
const store = new Map<string, string>();
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  },
});

afterEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    /* environment tanpa localStorage */
  }
  cleanup();
});

describe('panduan 9-Box untuk pemula', () => {
  beforeEach(() => {
    stubFetch();
  });

  it('modal kotak menampilkan tiga bagian panduan', async () => {
    render(<NineBoxMatrixPage />);

    // Buka kotak "Penggerak Inti" lewat grid inspeksi.
    fireEvent.click(screen.getAllByRole('button', { name: /Matriks 9-Box/i })[0]);
    const box = await screen.findByText('Penggerak Inti');
    fireEvent.click(box);

    await waitFor(() => expect(screen.getByText('Sedang terjadi')).toBeTruthy());
    expect(screen.getByText('Langkah pertama')).toBeTruthy();
    expect(screen.getByText('Yang perlu dicek dulu')).toBeTruthy();
  });

  it('tombol "Sembunyikan penjelasan" menyembunyikan kalimat singkat di grid', async () => {
    render(<NineBoxMatrixPage />);
    // Grid 9-Box berada di panel "Matriks 9-Box & Inspeksi".
    fireEvent.click(screen.getAllByRole('button', { name: /Matriks 9-Box/i })[0]);
    await waitFor(() => expect(screen.getAllByTestId('quad-short').length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: /Sembunyikan penjelasan/i }));

    expect(screen.queryAllByTestId('quad-short')).toHaveLength(0);
    expect(window.localStorage.getItem('epq:ninebox:showHelp')).toBe('false');
  });


});
