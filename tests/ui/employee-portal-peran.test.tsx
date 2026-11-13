// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

const roleRef = { current: 'HR_MANAGER' };

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/dashboard/employee-portal',
}));
vi.mock('@/lib/context/AuthContext', () => ({
  useAuth: () => ({ currentUser: { role: roleRef.current, name: 'Uji', employeeId: 'e1' }, activeRole: roleRef.current }),
  useOptionalAuth: () => ({ currentUser: { role: roleRef.current }, activeRole: roleRef.current }),
}));

import EmployeePortalPage from '@/app/dashboard/employee-portal/page';

const stub = () => {
  global.fetch = vi.fn(async () => ({
    ok: false,
    status: 500,
    json: async () => ({}),
  })) as any;
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Employee Growth Portal — kerangka per peran', () => {
  it('BOD tidak melihat "Indikator Pencapaian Target" (tidak dinilai lewat portal)', async () => {
    stub();
    roleRef.current = 'BOD';
    render(<EmployeePortalPage />);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Saat Kerja/i })).toBeTruthy());
    expect(document.body.textContent).not.toMatch(/Indikator Pencapaian Target/i);
  });

  it('HR melihat "Indikator Pencapaian Target" miliknya sendiri (dinilai BOD)', async () => {
    // Perubahan kebijakan: HR sebelumnya disembunyikan, padahal HR tetap perlu
    // memantau KPI & nilai kinerjanya sendiri.
    stub();
    roleRef.current = 'HR_MANAGER';
    render(<EmployeePortalPage />);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Saat Kerja/i })).toBeTruthy());
    await waitFor(() => expect(document.body.textContent).toMatch(/Indikator Pencapaian Target/i));
  });

  it('People Manager melihat "Indikator Pencapaian Target" miliknya sendiri', async () => {
    stub();
    roleRef.current = 'PEOPLE_MANAGER';
    render(<EmployeePortalPage />);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Saat Kerja/i })).toBeTruthy());
    await waitFor(() => expect(document.body.textContent).toMatch(/Indikator Pencapaian Target/i));
  });

  it('Employee tetap melihat "Indikator Pencapaian Target"', async () => {
    stub();
    roleRef.current = 'EMPLOYEE';
    render(<EmployeePortalPage />);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Saat Kerja/i })).toBeTruthy());
    await waitFor(() => expect(document.body.textContent).toMatch(/Indikator Pencapaian Target/i));
  });

  it('menampilkan tombol kembali ke dashboard asal untuk peran non-employee', async () => {
    stub();
    roleRef.current = 'HR_MANAGER';
    render(<EmployeePortalPage />);
    await waitFor(() => expect(screen.getByRole('link', { name: /Kembali ke/i })).toBeTruthy());
    const link = screen.getByRole('link', { name: /Kembali ke/i });
    expect(link.getAttribute('href')).toBe('/dashboard/hr-command');
  });

  it('Employee tidak melihat tombol kembali (tidak punya dashboard lain)', async () => {
    stub();
    roleRef.current = 'EMPLOYEE';
    render(<EmployeePortalPage />);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Saat Kerja/i })).toBeTruthy());
    expect(screen.queryByRole('link', { name: /Kembali ke/i })).toBeNull();
  });
});
