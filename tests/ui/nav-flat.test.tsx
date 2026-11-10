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

  it('menu relevan tampil datar; HR Command Center & tab-nya tidak diduplikasi di bilah atas', () => {
    render(<NavMenu />);
    // HR memakai tab di dalam halaman untuk Ringkasan & Kontrol 3-Fase.
    expect(screen.queryByRole('link', { name: /HR Ops Command Center/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /Offboarding & Clearance/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /9-Box/i })).toBeNull();
    // Employee tetap punya portalnya sendiri.
    expect(screen.queryByRole('link', { name: /Employee Growth Portal/i })).toBeNull();
    expect(screen.queryByText(/^Portals$/i)).toBeNull();
    expect(screen.queryByText(/Modul & Tata Kelola/i)).toBeNull();
  });
});
