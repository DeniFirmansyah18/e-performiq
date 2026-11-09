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

describe('tombol muat ulang data', () => {
  it('memuat ulang ringkasan dan tidak mengarang angka', async () => {
    let calls = 0;
    global.fetch = vi.fn(async (u: any) => {
      if (String(u).includes('nine-box-summary')) {
        calls++;
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'success', data: { total: 4, byQuadrant: { CORE_PLAYER: 4 } } }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ status: 'success', data: {} }) };
    }) as any;

    render(<NineBoxMatrixPage />);
    fireEvent.click(screen.getAllByRole('button', { name: /Matriks 9-Box/i })[0]);
    await waitFor(() => expect(calls).toBeGreaterThan(0));

    // Tiga pemicu memuat ulang (header, kartu, panel); pakai yang pertama.
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Muat ulang data/i }).length).toBeGreaterThan(0));
    const btn = screen.getAllByRole('button', { name: /Muat ulang data/i })[0];
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
});
