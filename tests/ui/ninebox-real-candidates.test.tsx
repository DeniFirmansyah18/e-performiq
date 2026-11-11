// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/dashboard/ninebox-matrix',
}));
vi.mock('@/lib/context/AuthContext', () => ({
  useAuth: () => ({ currentUser: { role: 'HR_MANAGER', name: 'Uji' }, activeRole: 'HR_MANAGER' }),
  useOptionalAuth: () => ({ currentUser: { role: 'HR_MANAGER' }, activeRole: 'HR_MANAGER' }),
}));

import NineBoxMatrixPage from '@/app/dashboard/ninebox-matrix/page';

const pegawai = (id: string, nama: string, nip: string) => ({
  employee_id: id,
  full_name: nama,
  employee_code: nip,
  department: 'Information Technology',
  position: 'Engineer',
  composite_gpa: 3.8,
  performance_rating: 'A',
});

const RESPONS = {
  total: 2,
  byQuadrant: { FUTURE_LEADER: 2 },
  talent_quadrants: [
    {
      quadrant: 'FUTURE_LEADER',
      label: 'Pemimpin Masa Depan',
      strategic_action: '',
      count: 2,
      percentage: 100,
      employees: [
        pegawai('b0000000-0000-4000-8000-000000000003', 'Raden Mas Danu', 'MGR-2020-0001'),
        pegawai('b0000000-0000-4000-8000-000000000004', 'Budi Pratama', 'EMP-2022-0042'),
      ],
    },
    {
      quadrant: 'CORE_PLAYER',
      label: 'Penggerak Inti',
      strategic_action: '',
      count: 0,
      percentage: 0,
      employees: [],
    },
  ],
};

const stub = () => {
  global.fetch = vi.fn(async (url: any) => {
    const u = String(url);
    if (u.includes('nine-box-summary')) {
      return { ok: true, json: async () => ({ data: RESPONS }) } as any;
    }
    if (u.includes('nine-box-distribution')) {
      return { ok: true, json: async () => ({ data: RESPONS }) } as any;
    }
    return { ok: false, status: 500, json: async () => ({}) } as any;
  }) as any;
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('panel 9-Box memakai data pegawai nyata', () => {
  it('menampilkan nama pegawai dari API pada kotak yang terisi', async () => {
    stub();
    render(<NineBoxMatrixPage />);
    // Buka panel matriks & inspeksi
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Matriks 9-Box & Inspeksi/i })).toBeTruthy()
    );
    fireEvent.click(screen.getByRole('button', { name: /Matriks 9-Box & Inspeksi/i }));

    // Kotak 9 (Pemimpin Masa Depan) terpilih secara default pada panel ini.
    await waitFor(() => expect(screen.getByText(/Raden Mas Danu/i)).toBeTruthy());
    expect(screen.getByText(/Budi Pratama/i)).toBeTruthy();
  });

  it('menampilkan keterangan jujur untuk kotak yang belum berisi pegawai', async () => {
    stub();
    render(<NineBoxMatrixPage />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Matriks 9-Box & Inspeksi/i })).toBeTruthy()
    );
    fireEvent.click(screen.getByRole('button', { name: /Matriks 9-Box & Inspeksi/i }));

    // Kotak pada matriks berupa div yang dapat diklik; pakai nama kuadrannya.
    const kotakPenggerak = await screen.findAllByText('Penggerak Inti');
    fireEvent.click(kotakPenggerak[0]);

    await waitFor(() => expect(screen.getByText(/Belum ada karyawan di kotak ini/i)).toBeTruthy());
  });

  it('menyediakan tombol kembali ke HR Command Center', async () => {
    stub();
    render(<NineBoxMatrixPage />);
    const link = await screen.findByRole('link', { name: /Kembali ke HR Command Center/i });
    expect(link.getAttribute('href')).toBe('/dashboard/hr-command');
  });
});
