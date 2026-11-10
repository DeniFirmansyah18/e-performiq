// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

const roleRef = { current: 'EMPLOYEE' };
vi.mock('@/lib/context/AuthContext', () => ({
  useAuth: () => ({ currentUser: { role: roleRef.current } }),
  useOptionalAuth: () => ({ currentUser: { role: roleRef.current } }),
}));

import MyProfileModal from '@/components/employee/MyProfileModal';

const profilDasar = {
  employeeCode: 'EMP-1',
  fullName: 'Budi',
  email: 'b@x.id',
  status: 'PERMANENT',
  nik: '123',
  gender: 'LAKI_LAKI',
  positionTitle: 'Engineer',
  departmentName: 'Engineering',
  managerName: 'Danu',
  managerCode: 'MGR-1',
  directReportCount: 0,
  joinDate: '2022-03-01',
};

const stub = (data: any) => {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ data }) })) as any;
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Profil Saya per peran', () => {
  it('Employee melihat jabatan & atasan, tanpa bawahan', async () => {
    stub(profilDasar);
    roleRef.current = 'EMPLOYEE';
    render(<MyProfileModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Kepegawaian')).toBeTruthy());
    expect(screen.getByText('Engineering')).toBeTruthy();
    // Nama atasan dirender bersama kode dalam satu elemen: "Danu (MGR-1)".
    expect(screen.getByText(/Danu/)).toBeTruthy();
    expect(screen.queryByText(/bawahan langsung/i)).toBeNull();
  });

  it('People Manager melihat jumlah bawahan', async () => {
    stub({ ...profilDasar, directReportCount: 5 });
    roleRef.current = 'PEOPLE_MANAGER';
    render(<MyProfileModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText(/5 bawahan langsung/i)).toBeTruthy());
  });

  it('BOD tidak melihat baris Dinilai oleh', async () => {
    stub({ ...profilDasar, managerName: null, directReportCount: 7 });
    roleRef.current = 'BOD';
    render(<MyProfileModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Kepegawaian')).toBeTruthy());
    expect(screen.queryByText(/Dinilai oleh/i)).toBeNull();
  });

  it('gaji pokok tidak pernah dirender', async () => {
    stub({ ...profilDasar, baseSalary: 99000000 });
    roleRef.current = 'HR_MANAGER';
    render(<MyProfileModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Kepegawaian')).toBeTruthy());
    expect(screen.queryByText(/gaji pokok/i)).toBeNull();
  });

  it('joinDate kosong tidak menghasilkan NaN', async () => {
    stub({ ...profilDasar, joinDate: null });
    roleRef.current = 'HR_MANAGER';
    render(<MyProfileModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Kepegawaian')).toBeTruthy());
    expect(document.body.textContent).not.toMatch(/NaN/);
  });
});
