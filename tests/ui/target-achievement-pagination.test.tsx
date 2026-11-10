// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';

import TargetAchievementCard from '@/components/performance/TargetAchievementCard';

/** 12 departemen -> 3 halaman (5 per halaman). */
const departemen = Array.from({ length: 12 }, (_, i) => ({
  departmentId: `d${i + 1}`,
  departmentName: `Departemen Uji ${i + 1}`,
  averagePercentage: 60 + i * 2,
  employeeCount: 5,
  kpiCount: 10,
}));

const respons = {
  role: 'HR_MANAGER',
  scopeLevel: 'ORGANIZATION',
  periodId: 'p1',
  periodCode: '2026-Q3',
  overallPercentage: 78.5,
  status: 'ON_TRACK',
  statusLabel: 'Sesuai Jalur',
  statusColor: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', bar: 'bg-blue-500' },
  targetCount: 120,
  achievedCount: 98,
  summary: { exceededCount: 3, onTrackCount: 4, atRiskCount: 3, criticalCount: 2 },
  individualKpis: [],
  teamMembers: [],
  perspectives: [],
  departments: departemen,
};

const stub = (analisisData: any = null) => {
  global.fetch = vi.fn(async (url: any) => {
    const u = String(url);
    if (u.includes('/analisis')) {
      return { ok: true, json: async () => ({ data: analisisData }) } as any;
    }
    if (u.includes('target-achievement')) {
      return { ok: true, json: async () => ({ data: respons }) } as any;
    }
    return { ok: false, status: 500, json: async () => ({}) } as any;
  }) as any;
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TargetAchievementCard — paginasi & analisis AI', () => {
  it('membatasi 5 departemen per halaman dan menampilkan nomor halaman', async () => {
    stub();
    render(<TargetAchievementCard />);
    await waitFor(() => expect(screen.getByText('Departemen Uji 1', { selector: 'p' })).toBeTruthy());

    expect(screen.getByText('Departemen Uji 5', { selector: 'p' })).toBeTruthy();
    expect(screen.queryByText('Departemen Uji 6', { selector: 'p' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Halaman departemen 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Halaman departemen 3' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Halaman departemen 4' })).toBeNull();
  });

  it('berpindah halaman menampilkan departemen berikutnya', async () => {
    stub();
    render(<TargetAchievementCard />);
    await waitFor(() => expect(screen.getByText('Departemen Uji 1', { selector: 'p' })).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Halaman departemen berikutnya' }));
    await waitFor(() => expect(screen.getByText('Departemen Uji 6', { selector: 'p' })).toBeTruthy());
    expect(screen.queryByText('Departemen Uji 1', { selector: 'p' })).toBeNull();
  });

  it('menampilkan panel rekomendasi AI di bawah daftar', async () => {
    stub();
    render(<TargetAchievementCard />);
    await waitFor(() => expect(screen.getByText(/Rekomendasi Tindakan dari AI/i)).toBeTruthy());
    expect(screen.getByRole('button', { name: /Minta analisis/i })).toBeTruthy();
  });

  it('menampilkan hasil analisis setelah tombol diklik', async () => {
    stub({ insight: 'Keuangan baru 62%. Lakukan pendampingan penyusunan KPI.', configured: true, failed: false });
    render(<TargetAchievementCard />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Minta analisis/i })).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /Minta analisis/i }));
    await waitFor(() =>
      expect(screen.getByText(/Keuangan baru 62%/)).toBeTruthy()
    );
  });

  it('memberi catatan jujur bila AI belum dikonfigurasi', async () => {
    stub({ insight: 'AI belum dikonfigurasi.', configured: false, failed: false });
    render(<TargetAchievementCard />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Minta analisis/i })).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /Minta analisis/i }));
    await waitFor(() =>
      expect(screen.getByText(/belum aktif karena kunci API belum diatur/i)).toBeTruthy()
    );
  });
});
