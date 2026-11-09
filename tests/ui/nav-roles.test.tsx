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

  it('HR tidak melihat Employee Portal di bilah atas', () => {
    renderFor('HR_MANAGER');
    expect(screen.queryByRole('link', { name: /Employee Growth Portal/i })).toBeNull();
    expect(screen.getByRole('link', { name: /HR Ops Command Center/i })).toBeTruthy();
  });

  it('BOD tidak melihat 9-Box maupun HR Ops, tetapi tetap punya jalan ke HR Command Center', () => {
    renderFor('BOD');
    expect(screen.queryByRole('link', { name: /9-Box/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /HR Ops Command Center/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /Employee Growth Portal/i })).toBeNull();
    const offboarding = screen.getByRole('link', { name: /Offboarding & Clearance/i });
    expect(offboarding.getAttribute('href')).toContain('/dashboard/hr-command');
  });

  it('SUPER_ADMIN hanya melihat Manajemen Akun (tanpa tautan mati)', () => {
    renderFor('SUPER_ADMIN');
    expect(screen.getByRole('link', { name: /Manajemen Akun/i })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Employee Growth Portal/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /HR Ops Command Center/i })).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('label teks disembunyikan tetapi nama aksesibel tetap ada', () => {
    renderFor('HR_MANAGER');
    const link = screen.getByRole('link', { name: /HR Ops Command Center/i });
    expect(link.getAttribute('title')).toBe('HR Ops Command Center');
    expect(link.textContent?.trim()).toBe('');
  });

  it('tombol Panduan tidak ada lagi di NavMenu', () => {
    renderFor('HR_MANAGER');
    expect(screen.queryByRole('button', { name: /Panduan/i })).toBeNull();
  });
});
