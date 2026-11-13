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
  // Panel "Data Kepegawaian" (BPJS, berkas, kelengkapan) memanggil endpoint
  // sendiri; beri bentuk yang sesuai agar komponen dapat dirender.
  global.fetch = vi.fn(async (url: any) => {
    const u = String(url);
    if (u.includes('/me/documents')) {
      return { ok: true, json: async () => ({ data: { items: [], kelengkapan: null } }) } as any;
    }
    return { ok: true, json: async () => ({ data }) } as any;
  }) as any;
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

  it('nilai gaji pokok tidak pernah muncul di DOM terlepas dari labelnya', async () => {
    // Angka sengaja unik (99.000.000) agar dapat dicari apa pun label yang dipakai.
    stub({ ...profilDasar, baseSalary: 99000000 });
    roleRef.current = 'HR_MANAGER';
    render(<MyProfileModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Kepegawaian')).toBeTruthy());
    const teks = document.body.textContent || '';
    // Cocokkan angkanya, bukan kata "gaji pokok": 99000000 / 99.000.000 / 99,000,000.
    expect(teks).not.toMatch(/9\s?9\s?[.,]?\s?0\s?0\s?0\s?[.,]?\s?0\s?0\s?0/);
    expect(teks).not.toContain('99000000');
  });

  it('joinDate kosong tidak menghasilkan NaN', async () => {
    stub({ ...profilDasar, joinDate: null });
    roleRef.current = 'HR_MANAGER';
    render(<MyProfileModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Kepegawaian')).toBeTruthy());
    expect(document.body.textContent).not.toMatch(/NaN/);
  });
});
