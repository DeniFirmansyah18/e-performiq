// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent, within } from '@testing-library/react';
import HROperationsPage from '@/app/dashboard/hr-command/page';
import { AuthProvider } from '@/lib/context/AuthContext';

const okJson = (data: unknown) => ({ ok: true, json: async () => ({ status: 'success', data }) });

const renderPage = () =>
  render(
    <AuthProvider>
      <HROperationsPage />
    </AuthProvider>
  );

const tabButton = (label: RegExp) => screen.getByRole('button', { name: label });

/** Buka tab Kontrol Siklus lalu kembalikan helper tombol fase. */
async function openLifecycleTab() {
  fireEvent.click(tabButton(/Kontrol Siklus 3-Fase/i));
  const group = await screen.findByRole('group', { name: /Pilih fase siklus karyawan/i });
  return {
    group,
    phase: (label: string) => within(group).getByRole('button', { name: label }),
  };
}

const summary = {
  period_code: '2026-Q3',
  headcount: { total: 9, probation: 1, resigned: 2 },
  appraisal: { total_appraised: 1, average_gpa: 3.67, high_potential_count: 1 },
  benchmarks: { turnover_max: 3, vmai_target: 85 },
};

const profile = {
  headcount: { total: 9, active: 7, probation: 1, pkwt: 1, permanent: 5 },
  byDepartment: [{ label: 'Information Technology', count: 5, percentage: 71.4 }],
  byGender: [{ label: 'Laki-laki', count: 5, percentage: 71.4 }],
  byAgeBand: [{ label: '25-34 tahun', count: 4, percentage: 57.1 }],
  byJobGrade: [{ label: 'G3', count: 7, percentage: 100 }],
  kpiAchievement: { averagePercentage: 94.5, belowTargetCount: 2, totalKpi: 4 },
  ratingDistribution: [{ rating: 'A', count: 3, percentage: 75 }],
  mppFulfillment: { quota: 12, hired: 9, percentage: 75 },
};

const dashHr = {
  workforce: { total: 9, permanent: 5, probation: 1, contract: 1, resigned: 2 },
  recruitment: { openPostings: 3, totalApplications: 42, inReview: 8, accepted: 5, rejected: 4, talentPool: 12, avgAtsScore: 78 },
  onboarding: { activePrograms: 2, completedPrograms: 6, certificatesIssued: 6 },
  attendance: { openLogsToday: 1, closedLogsToday: 8, pendingTimesheets: 2, overtimeHoursThisMonth: 14 },
  payroll: { latestPeriod: '2026-09', latestStatus: 'PAID', latestTotalNet: 120000000, totalRuns: 9 },
  learning: { totalCourses: 12, enrollments: 30, completions: 22, completionRate: 73 },
  postEmployment: { activeOffboardings: 1, knowledgeHandoversPending: 1, severancesPending: 1, totalLifetimeContributions: 7 },
};

const dashPost = {
  offboardings: [],
  leave: { pending: 2, approvedThisYear: 5, daysApprovedThisYear: 12 },
  lifetimeContributions: { total: 7, byType: { PROJECT: 4, MENTORING: 3 } },
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes('/auth/me')) {
      return okJson({ user: { id: 'e0000000-0000-4000-8000-000000000002', email: 'hr@demo.test', fullName: 'HR Manager', role: 'HR_MANAGER' } });
    }
    if (u.includes('dashboard/hr')) return okJson(dashHr);
    if (u.includes('dashboard/post-employment')) return okJson(dashPost);
    if (u.includes('workforce-profile')) return okJson(profile);
    if (u.includes('executive-summary')) return okJson(summary);
    if (u.includes('lifecycle-summary')) return okJson({ mpp_fulfillment_percentage: 75, average_quality_of_hire: 88.5, probation_conversion_percentage: 50 });
    if (u.includes('offboarding/initiate')) return okJson([]);
    if (u.includes('nine-box-distribution')) return okJson({ talent_quadrants: [] });
    if (u.includes('activity-feed')) return okJson({ items: [] });
    return okJson({});
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

describe('HR Command Center — isolasi fase siklus kerja', () => {
  it('menyembunyikan panel fase setelah pindah tab', async () => {
    renderPage();
    const { phase } = await openLifecycleTab();

    fireEvent.click(phase('Setelah Kerja'));
    fireEvent.click(await screen.findByText('Ringkasan SDM & Pasca-Kerja'));

    // Kartu fase + judul panel sama-sama memakai teks ini, jadi hitung kemunculannya.
    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: 'Ringkasan SDM & Pasca-Kerja' })).toHaveLength(2);
    });

    // Pindah tab: panel fase harus hilang, bukan ikut terbawa ke tab lain.
    fireEvent.click(tabButton(/Direktori/i));
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Ringkasan SDM & Pasca-Kerja' })).toBeNull();
    });

    // Kembali ke tab siklus: panel tetap tertutup sampai kartu dibuka lagi (hanya kartu tersisa).
    fireEvent.click(tabButton(/Kontrol Siklus 3-Fase/i));
    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: 'Ringkasan SDM & Pasca-Kerja' })).toHaveLength(1);
    });
  });

  it('fase Setelah Kerja tidak menampilkan kartu fase Pra-Kerja', async () => {
    renderPage();
    const { phase } = await openLifecycleTab();

    fireEvent.click(phase('Setelah Kerja'));
    await screen.findByText('Ringkasan SDM & Pasca-Kerja');

    expect(screen.queryByText('Kelola MPP')).toBeNull();
    expect(screen.queryByText('Rekrutmen Kandidat')).toBeNull();
  });

  it('fase Sebelum Kerja tidak menampilkan kartu fase Saat/Pasca-Kerja', async () => {
    renderPage();
    const { phase } = await openLifecycleTab();

    fireEvent.click(phase('Sebelum Kerja'));
    await screen.findByText('Kelola MPP');

    expect(screen.queryByText('Ringkasan SDM & Pasca-Kerja')).toBeNull();
    expect(screen.queryByText('Payroll & Kompensasi')).toBeNull();
  });

  it('menghormati deep-link ?tab= & ?feature= saat halaman dibuka', async () => {
    window.history.replaceState({}, '', '/dashboard/hr-command?tab=lifecycle&phase=POST&feature=hr-dashboard');
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Ringkasan SDM & Pasca-Kerja' })).toBeTruthy();
  });

  it('berpindah tab saat tautan ?tab= berubah tanpa me-remount halaman', async () => {
    renderPage();
    await openLifecycleTab();

    // Simulasi klik "Tinjau" pada rekomendasi: navigasi client-side ke tab direktori.
    window.history.pushState({}, '', '/dashboard/hr-command?tab=directory');

    await waitFor(() => {
      expect(screen.getByText(/Direktori Pegawai/i)).toBeTruthy();
    });
  });
});
