// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/dashboard/hr-command',
}));
vi.mock('@/lib/context/AuthContext', () => ({
  useAuth: () => ({ currentUser: { role: 'HR_MANAGER' }, activeRole: 'HR_MANAGER' }),
  useOptionalAuth: () => ({ currentUser: { role: 'HR_MANAGER' }, activeRole: 'HR_MANAGER' }),
}));

import HROperationsPage from '@/app/dashboard/hr-command/page';

const stub = () => {
  global.fetch = vi.fn(async (url: any) => {
    const u = String(url);
    if (u.includes('workforce-profile') || u.includes('executive-summary')) {
      return {
        ok: true,
        json: async () => ({
          data: {
            headcount: { total: 1, active: 1, probation: 0, pkwt: 0, permanent: 1 },
            byDepartment: [], byGender: [], byAgeBand: [], byJobGrade: [],
            kpiAchievement: { averagePercentage: 80, belowTargetCount: 0, totalKpi: 1 },
            ratingDistribution: [],
            mppFulfillment: { quota: 1, hired: 1, percentage: 100 },
            appraisal: { high_potential_count: 2 },
            high_potential_count: 2,
          },
        }),
      } as any;
    }
    if (u.includes('nine-box')) {
      return { ok: true, json: async () => ({ data: { total: 0, byQuadrant: {} } }) } as any;
    }
    return { ok: false, status: 500, json: async () => ({}) } as any;
  }) as any;
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('tab Ringkasan & Analitik — urutan blok', () => {
  it('Indikator Pencapaian Target Organisasi berada SETELAH penjelasan 9-Box', async () => {
    stub();
    render(<HROperationsPage />);
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/Matriks 9-Box di bawah menampilkan sebaran lengkap/)
    );

    const teks = (document.body.textContent || '').replace(/\s+/g, ' ');
    // Blok kartu target dikenali dari judulnya, atau dari pesan gagal-muatnya
    // (keduanya hanya tampil bila kartu itu dirender).
    const posPenjelasan = teks.indexOf('Matriks 9-Box di bawah menampilkan sebaran lengkap');
    const posIndikator = teks.search(/Indikator Pencapaian Target|Gagal memuat indikator pencapaian target/);

    expect(posPenjelasan).toBeGreaterThan(-1);
    expect(posIndikator).toBeGreaterThan(-1);
    expect(posIndikator).toBeGreaterThan(posPenjelasan);
  });
});
