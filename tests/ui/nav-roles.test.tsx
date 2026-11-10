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
  it('Employee melihat Employee Portal (satu-satunya dashboard-nya)', () => {
    renderFor('EMPLOYEE');
    expect(screen.getByRole('link', { name: /Employee Growth Portal/i })).toBeTruthy();
  });

  it('HR tidak lagi melihat HR Ops maupun Offboarding (keduanya ada sebagai tab di dalam halaman)', () => {
    renderFor('HR_MANAGER');
    expect(screen.queryByRole('link', { name: /HR Ops Command Center/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /Offboarding & Clearance/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /Employee Growth Portal/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /9-Box/i })).toBeNull();
    // Tab Ringkasan & Kontrol 3-Fase tetap ada di dalam halaman HR Command Center.
  });

  it('BOD tetap punya Executive Boardroom, tanpa HR Ops/Offboarding', () => {
    renderFor('BOD');
    expect(screen.getByRole('link', { name: /Executive Boardroom/i })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /HR Ops Command Center/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /Offboarding & Clearance/i })).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('PEOPLE_MANAGER tetap punya Manager Evaluation Cockpit', () => {
    renderFor('PEOPLE_MANAGER');
    expect(screen.getByRole('link', { name: /Manager Evaluation Cockpit/i })).toBeTruthy();
  });

  it('SUPER_ADMIN hanya melihat Manajemen Akun (tanpa tautan mati)', () => {
    renderFor('SUPER_ADMIN');
    expect(screen.getByRole('link', { name: /Manajemen Akun/i })).toBeTruthy();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('label teks disembunyikan tetapi nama aksesibel tetap ada', () => {
    renderFor('PEOPLE_MANAGER');
    const link = screen.getByRole('link', { name: /Manager Evaluation Cockpit/i });
    expect(link.getAttribute('title')).toBe('Manager Evaluation Cockpit');
    expect(link.textContent?.trim()).toBe('');
  });

  it('tombol Panduan tidak ada lagi di NavMenu', () => {
    renderFor('HR_MANAGER');
    expect(screen.queryByRole('button', { name: /Panduan/i })).toBeNull();
  });
});
