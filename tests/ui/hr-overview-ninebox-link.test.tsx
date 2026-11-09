// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

const roleRef = { current: 'HR_MANAGER' };
vi.mock('@/lib/context/AuthContext', () => ({
  useAuth: () => ({ activeRole: roleRef.current }),
  useOptionalAuth: () => ({ activeRole: roleRef.current }),
}));

import HrOverviewAnalyticsPanel from '@/components/governance/HrOverviewAnalyticsPanel';

/** Panel hanya merender isi bila fetch berhasil; sediakan data minimal. */
const okStub = () => {
  global.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      status: 'success',
      data: {
        headcount: { total: 1, active: 1, probation: 0, pkwt: 0, permanent: 1 },
        byDepartment: [{ label: 'TI', count: 1, percentage: 100 }],
        byGender: [{ label: 'L', count: 1, percentage: 100 }],
        byAgeBand: [{ label: '25-34', count: 1, percentage: 100 }],
        byJobGrade: [{ label: '3', count: 1, percentage: 100 }],
        kpiAchievement: { averagePercentage: 80, belowTargetCount: 0, totalKpi: 1 },
        ratingDistribution: [{ rating: 'A', count: 1, percentage: 100 }],
        mppFulfillment: { quota: 1, hired: 1, percentage: 100 },
        high_potential_count: 1,
        appraisal: { high_potential_count: 1 },
        total: 1,
        byQuadrant: { CORE_PLAYER: 1 },
      },
    }),
  })) as any;
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('tautan Matriks 9-Box di tab Ringkasan', () => {
  it('menampilkan tautan Buka Matriks 9-Box untuk HR', async () => {
    okStub();
    roleRef.current = 'HR_MANAGER';
    render(<HrOverviewAnalyticsPanel />);
    const link = await screen.findByRole('link', { name: /Buka Matriks 9-Box/i });
    expect(link.getAttribute('href')).toBe('/dashboard/ninebox-matrix');
  });

  it('tidak menampilkan tautan untuk peran tanpa akses 9-Box', async () => {
    okStub();
    roleRef.current = 'EMPLOYEE';
    render(<HrOverviewAnalyticsPanel />);
    await waitFor(() => expect(screen.queryByRole('link', { name: /Buka Matriks 9-Box/i })).toBeNull());
  });
});
