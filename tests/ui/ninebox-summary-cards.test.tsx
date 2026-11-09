// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/dashboard/ninebox-matrix',
}));

import NineBoxMatrixPage from '@/app/dashboard/ninebox-matrix/page';

afterEach(() => cleanup());

describe('kartu ringkas 9-Box', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('menampilkan kartu ringkas dari data nyata', async () => {
    global.fetch = vi.fn(async (u: any) => {
      if (String(u).includes('nine-box-summary')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'success',
            data: { total: 6, byQuadrant: { UNDERPERFORMER: 1, ENIGMA: 2, FUTURE_LEADER: 3 } },
          }),
        };
      }
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

    const perhatian = await screen.findByTestId('summary-perhatian');
    expect(perhatian.textContent).toContain('Data belum tersedia');
    expect(screen.queryByText('1.240')).toBeNull();
  });
});
