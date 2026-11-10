// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/hr-command',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

import HROperationsPage from '@/app/dashboard/hr-command/page';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const stub = () => {
  global.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as any;
};

describe('tautan Portal Saya di HR Command Center', () => {
  it('menampilkan tautan "Portal Saya" yang mengarah ke Employee Growth Portal', async () => {
    stub();
    render(<HROperationsPage />);
    const link = await screen.findByRole('link', { name: /Portal Saya/i });
    expect(link.getAttribute('href')).toBe('/dashboard/employee-portal');
  });

  it('tombol "Kalibrasi Nilai Semester" sudah tidak ada (fitur kalibrasi dihapus)', async () => {
    stub();
    render(<HROperationsPage />);
    expect(screen.queryByRole('button', { name: /Kalibrasi Nilai Semester/i })).toBeNull();
  });
});
