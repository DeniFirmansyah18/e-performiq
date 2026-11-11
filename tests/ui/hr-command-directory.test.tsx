// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import EmployeeDirectoryPanel from '@/components/governance/EmployeeDirectoryPanel';

const okJson = (data: unknown) => ({ ok: true, json: async () => ({ status: 'success', data }) });

const directory = {
  employees: [
    { employeeId: 'e1', employeeCode: 'EMP-2022-0042', fullName: 'Budi Pratama',
      status: 'PERMANENT', department: 'Information Technology', position: 'Staff IT' },
    { employeeId: 'e2', employeeCode: 'EMP-2023-0108', fullName: 'Anisa Wijaya',
      status: 'PERMANENT', department: 'Information Technology', position: 'UI/UX Designer' },
  ],
  total: 2,
};

const contribution = {
  employeeId: 'e1',
  fullName: 'Budi Pratama',
  employeeCode: 'EMP-2022-0042',
  departmentName: 'Information Technology',
  positionTitle: 'Staff IT',
  jobGrade: 'G3',
  employmentStatus: 'PKWT',
  latestGpa: 3.67,
  latestRating: 'A',
  nineBoxQuadrant: 'FUTURE_LEADER',
  hasKpi: true,
  pillars: [
    { pillarId: 'p1', pillarName: 'Transformasi Digital', perspective: 'INTERNAL_PROCESS',
      strategicWeight: 30, kpiCount: 2, achievementPercentage: 96.5 },
  ],
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes('bsc-contribution')) return okJson(contribution);
    if (u.includes('employee-directory')) return okJson(directory);
    return okJson({});
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('EmployeeDirectoryPanel (pilar 7)', () => {
  it('menampilkan daftar pegawai dan menyaring lewat pencarian instan', async () => {
    render(<EmployeeDirectoryPanel />);
    await waitFor(() => expect(screen.getByText(/Budi Pratama/)).toBeTruthy());
    expect(screen.getByText(/Anisa Wijaya/)).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/Cari nama/), {
      target: { value: 'anisa' },
    });
    await waitFor(() => expect(screen.queryByText(/Budi Pratama/)).toBeNull());
    expect(screen.getByText(/Anisa Wijaya/)).toBeTruthy();
  });

  it('kolom Detail hanya berisi tautan ke halaman detail pegawai', async () => {
    render(<EmployeeDirectoryPanel />);
    await waitFor(() => expect(screen.getByText(/Budi Pratama/)).toBeTruthy());

    const tautan = screen.getAllByRole('link', { name: /Detail Pegawai/i });
    expect(tautan.length).toBeGreaterThan(0);
    expect(tautan[0].getAttribute('href')).toMatch(/^\/dashboard\/employees\//);

    // Kontribusi BSC dipindah ke halaman detail, jadi tombol lama tidak ada.
    expect(screen.queryByRole('button', { name: /Lihat kontribusi/i })).toBeNull();
  });

  it('menghormati initialSearch dari deep-link', async () => {
    render(<EmployeeDirectoryPanel initialSearch="EMP-2023-0108" />);
    await waitFor(() => expect(screen.getByText(/Anisa Wijaya/)).toBeTruthy());
    expect(screen.queryByText(/Budi Pratama/)).toBeNull();
  });
});