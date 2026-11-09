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

const openGrid = () =>
  fireEvent.click(screen.getAllByRole('button', { name: /Matriks 9-Box/i })[0]);

describe('persentase kotak 9-Box', () => {
  it('dihitung dari data nyata', async () => {
    global.fetch = vi.fn(async (u: any) => {
      if (String(u).includes('nine-box-summary')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'success',
            data: { total: 4, byQuadrant: { CORE_PLAYER: 3, FUTURE_LEADER: 1 } },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ status: 'success', data: {} }) };
    }) as any;

    render(<NineBoxMatrixPage />);
    openGrid();

    await waitFor(() => {
      expect(screen.getAllByTestId('box-percent').some((e) => e.textContent === '75,0%')).toBe(true);
    });

    const semua = screen.getAllByTestId('box-percent').map((e) => e.textContent);
    expect(semua).toHaveLength(9);
    expect(semua).toContain('25,0%');
    expect(semua).toContain('0,0%');
    expect(screen.queryByText(/Top 3\.4%/)).toBeNull();
  });

  it('saat data belum dimuat menampilkan "—", bukan 0% atau NaN', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as any;

    render(<NineBoxMatrixPage />);
    openGrid();

    await waitFor(() => expect(screen.getAllByTestId('box-percent')).toHaveLength(9));
    for (const e of screen.getAllByTestId('box-percent')) {
      expect(e.textContent).toBe('—');
    }
  });

  it('total nol tidak menghasilkan NaN atau Infinity', async () => {
    global.fetch = vi.fn(async (u: any) => {
      if (String(u).includes('nine-box-summary')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'success', data: { total: 0, byQuadrant: {} } }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ status: 'success', data: {} }) };
    }) as any;

    render(<NineBoxMatrixPage />);
    openGrid();

    await waitFor(() => expect(screen.getAllByTestId('box-percent')).toHaveLength(9));
    const txt = document.body.textContent ?? '';
    expect(txt).not.toMatch(/NaN|Infinity/);
  });

  it('saat data belum dimuat, jumlah karyawan juga "—", bukan 0 (konsisten dengan kartu ringkas)', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as any;
    render(<NineBoxMatrixPage />);
    openGrid();
    await waitFor(() => expect(screen.getAllByTestId('box-count')).toHaveLength(9));
    for (const e of screen.getAllByTestId('box-count')) {
      expect(e.textContent).toBe('—');
    }
    expect(document.body.textContent).not.toMatch(/0\s*karyawan/);
  });

  it('"Muat ulang data" tidak mengaku berhasil saat server menolak', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as any;
    render(<NineBoxMatrixPage />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Muat ulang data/i }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole('button', { name: /Muat ulang data/i })[0]);
    await waitFor(() => expect(document.body.textContent).toMatch(/gagal|tidak dapat/i));
    expect(document.body.textContent).not.toMatch(/berhasil dimuat ulang/i);
  });
});
