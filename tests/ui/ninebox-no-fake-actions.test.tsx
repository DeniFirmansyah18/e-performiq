// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/dashboard/ninebox-matrix',
}));

import NineBoxMatrixPage from '@/app/dashboard/ninebox-matrix/page';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('tidak ada aksi palsu', () => {
  it('tidak ada tombol yang memanggil alert()', async () => {
    const spy = vi.fn();
    vi.stubGlobal('alert', spy);
    global.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as any;

    render(<NineBoxMatrixPage />);
    // Buka panel matriks agar tombol di dalamnya ikut dirender.
    fireEvent.click(screen.getAllByRole('button', { name: /Matriks 9-Box/i })[0]);
    await waitFor(() => expect(screen.getByText('Penggerak Inti')).toBeTruthy());

    for (const b of screen.getAllByRole('button')) {
      fireEvent.click(b);
    }

    await waitFor(() => expect(spy).not.toHaveBeenCalled());
  });

  it('tombol Download Matriks PDF dan audit dossier tidak ada lagi', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as any;
    render(<NineBoxMatrixPage />);

    expect(screen.queryByRole('button', { name: /Download Matriks PDF/i })).toBeNull();
    expect(screen.queryByTitle(/Buka detail kuadran lengkap/i)).toBeNull();
  });

  it('tabel kesiapan suksesi: jumlah kolom header sama dengan jumlah sel tiap baris', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as any;
    render(<NineBoxMatrixPage />);
    fireEvent.click(screen.getAllByRole('button', { name: /Kesiapan Suksesi/i })[0]);
    await waitFor(() => expect(document.querySelector('table')).toBeTruthy());

    const table = document.querySelector('table')!;
    const thCount = table.querySelectorAll('thead th').length;
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.querySelectorAll('td').length).toBe(thCount);
    }
  });
});
