// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/hr-command',
}));

vi.mock('@/lib/context/AuthContext', () => ({
  useAuth: () => ({ activeRole: 'HR_MANAGER' }),
}));

import NavMenu from '@/components/navigation/NavMenu';

afterEach(() => cleanup());

describe('menu datar', () => {
  it('tidak ada lagi label grup Portals / Modul & Tata Kelola', () => {
    render(<NavMenu />);
    expect(screen.queryByText(/^Portals$/i)).toBeNull();
    expect(screen.queryByText(/Modul & Tata Kelola/i)).toBeNull();
  });

  it('menu relevan tampil langsung sebagai tautan top-level', () => {
    render(<NavMenu />);
    expect(screen.getByRole('link', { name: /HR Ops Command Center/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Offboarding & Clearance/i })).toBeTruthy();
    // 9-Box dipindah ke tab Ringkasan HR Command Center, bukan bilah atas.
    expect(screen.queryByRole('link', { name: /9-Box/i })).toBeNull();
  });
});
