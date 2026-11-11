// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const roleRef = { current: 'HR_MANAGER' };
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard/hr-command' }));
vi.mock('@/lib/context/AuthContext', () => ({
  useAuth: () => ({ activeRole: roleRef.current }),
}));

import NavMenu from '@/components/navigation/NavMenu';

const renderFor = (role: string) => {
  roleRef.current = role;
  return render(<NavMenu />);
};

afterEach(() => cleanup());

describe('menu per peran', () => {
  it('Employee tidak melihat badge Portal Karyawan jika hanya memiliki role karyawan', () => {
    renderFor('EMPLOYEE');
    expect(screen.queryByRole('link', { name: /Portal Karyawan/i })).toBeNull();
  });

  it('HR tidak lagi melihat link dashboard (karena menggunakan tab internal HR Command Center)', () => {
    renderFor('HR_MANAGER');
    expect(screen.queryByRole('link', { name: /HR Ops Command Center/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /Offboarding & Clearance/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /Portal Karyawan/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /9-Box/i })).toBeNull();
  });

  it('BOD melihat Ruang Eksekutif (CEO) dan Peta Talenta & Suksesi', () => {
    renderFor('BOD');
    expect(screen.getByRole('link', { name: /Ruang Eksekutif \(CEO\)/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Peta Talenta & Suksesi/i })).toBeTruthy();
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('PEOPLE_MANAGER punya Cockpit Evaluasi Manajer dan opsi ke Portal Karyawan', () => {
    renderFor('PEOPLE_MANAGER');
    expect(screen.getByRole('link', { name: /Cockpit Evaluasi Manajer/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Portal Karyawan/i })).toBeTruthy();
  });

  it('SUPER_ADMIN hanya melihat Manajemen Akun (tanpa tautan mati)', () => {
    renderFor('SUPER_ADMIN');
    expect(screen.getByRole('link', { name: /Manajemen Akun/i })).toBeTruthy();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('label teks ditampilkan jelas dengan ikon', () => {
    renderFor('PEOPLE_MANAGER');
    const link = screen.getByRole('link', { name: /Cockpit Evaluasi Manajer/i });
    expect(link.getAttribute('title')).toBe('Cockpit Evaluasi Manajer');
    expect(link.textContent?.trim()).toContain('Cockpit Evaluasi Manajer');
  });

  it('tombol Panduan tidak ada lagi di NavMenu', () => {
    renderFor('HR_MANAGER');
    expect(screen.queryByRole('button', { name: /Panduan/i })).toBeNull();
  });
});
