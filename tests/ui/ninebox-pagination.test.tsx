// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/dashboard/ninebox-matrix',
}));
vi.mock('@/lib/context/AuthContext', () => ({
  useAuth: () => ({ currentUser: { role: 'HR_MANAGER' }, activeRole: 'HR_MANAGER' }),
  useOptionalAuth: () => ({ currentUser: { role: 'HR_MANAGER' }, activeRole: 'HR_MANAGER' }),
}));

import NineBoxMatrixPage from '@/app/dashboard/ninebox-matrix/page';

/** 12 pegawai pada satu kotak -> 3 halaman (5 per halaman). */
const pegawai12 = Array.from({ length: 12 }, (_, i) => ({
  employee_id: `id-${i + 1}`,
  full_name: `Pegawai Uji ${i + 1}`,
  employee_code: `EMP-${String(i + 1).padStart(4, '0')}`,
  department: 'Information Technology',
  position: 'Engineer',
  composite_gpa: 3.5,
  performance_rating: 'A',
}));

const respons = {
  total: 12,
  byQuadrant: { FUTURE_LEADER: 12 },
  talent_quadrants: [
    {
      quadrant: 'FUTURE_LEADER',
      label: 'Pemimpin Masa Depan',
      strategic_action: '',
      count: 12,
      percentage: 100,
      employees: pegawai12,
    },
  ],
};

const stub = () => {
  global.fetch = vi.fn(async (url: any) => {
    const u = String(url);
    if (u.includes('nine-box-distribution') || u.includes('nine-box-summary')) {
      return { ok: true, json: async () => ({ data: respons }) } as any;
    }
    return { ok: false, status: 500, json: async () => ({}) } as any;
  }) as any;
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('pagination daftar pegawai 9-Box', () => {
  it('membatasi 5 baris per halaman dan menampilkan nomor halaman', async () => {
    stub();
    render(<NineBoxMatrixPage />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Matriks 9-Box & Inspeksi/i })).toBeTruthy()
    );
    fireEvent.click(screen.getByRole('button', { name: /Matriks 9-Box & Inspeksi/i }));

    // Halaman 1: pegawai 1-5, bukan 6.
    await waitFor(() => expect(screen.getByText('Pegawai Uji 1')).toBeTruthy());
    expect(screen.getByText('Pegawai Uji 5')).toBeTruthy();
    expect(screen.queryByText('Pegawai Uji 6')).toBeNull();

    // Nomor halaman 1..3 (12 pegawai / 5 = 3 halaman, maksimal 5 tombol).
    expect(screen.getByRole('button', { name: 'Halaman pegawai 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Halaman pegawai 3' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Halaman pegawai 4' })).toBeNull();
  });

  it('berpindah halaman menampilkan pegawai berikutnya', async () => {
    stub();
    render(<NineBoxMatrixPage />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Matriks 9-Box & Inspeksi/i })).toBeTruthy()
    );
    fireEvent.click(screen.getByRole('button', { name: /Matriks 9-Box & Inspeksi/i }));
    await waitFor(() => expect(screen.getByText('Pegawai Uji 1')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Halaman pegawai berikutnya' }));
    await waitFor(() => expect(screen.getByText('Pegawai Uji 6')).toBeTruthy());
    expect(screen.queryByText('Pegawai Uji 1')).toBeNull();
  });
});
