// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/dashboard/hr-command',
}));

import HROperationsPage from '@/app/dashboard/hr-command/page';
import { AuthProvider } from '@/lib/context/AuthContext';

const okJson = (d: unknown) => ({ ok: true, status: 200, json: async () => ({ status: 'success', data: d }) });

const renderPage = () =>
  render(
    <AuthProvider>
      <HROperationsPage />
    </AuthProvider>
  );

const stub = () => {
  global.fetch = vi.fn(async (url: any) => {
    const u = String(url);
    if (u.includes('/analytics/executive-summary'))
      return okJson({
        period_code: '2026-Q3',
        headcount: { total: 9, probation: 1, resigned: 2 },
        appraisal: { total_appraised: 1, average_gpa: 3.67, high_potential_count: 1 },
        benchmarks: { turnover_max: 3, vmai_target: 85 },
      }) as any;
    if (u.includes('/hr/workforce-profile'))
      return okJson({
        headcount: { total: 9, active: 7, probation: 1, pkwt: 1, permanent: 5 },
        byDepartment: [], byGender: [], byAgeBand: [], byJobGrade: [],
        kpiAchievement: { averagePercentage: 90, belowTargetCount: 0, totalKpi: 1 },
        ratingDistribution: [], mppFulfillment: { quota: 1, hired: 1, percentage: 100 },
      }) as any;
    // Panel fase memakai data berupa ARRAY langsung.
    if (u.includes('/offboarding/initiate')) return okJson([]) as any;
    if (u.includes('/analytics/lifecycle-summary'))
      return okJson({ mpp_fulfillment_percentage: 90, average_quality_of_hire: 80, probation_conversion_percentage: 85 }) as any;
    if (u.includes('/pre-employment/mpp-summary'))
      return okJson({ plans: [], assessments: [], departments: [], positions: [] }) as any;
    if (u.includes('/recruitment/candidates')) return okJson({ candidates: [] }) as any;
    return okJson({}) as any;
  }) as any;
};

/** Buka tab Kontrol Siklus lalu fase "Sebelum Kerja". */
async function bukaFaseSebelumKerja() {
  await waitFor(() => expect(screen.getByRole('button', { name: /Kontrol Siklus 3-Fase/i })).toBeTruthy(), { timeout: 8000 });
  fireEvent.click(screen.getByRole('button', { name: /Kontrol Siklus 3-Fase/i }));
  const tahap = await screen.findAllByRole('button', { name: /Sebelum Kerja/i }, { timeout: 8000 });
  fireEvent.click(tahap[0]);
}

/**
 * ExpandablePanel merender <section> sendiri, jadi section panel adalah
 * leluhur TERDEKAT dari tombol tutup. Yang diuji: panel berada di dalam
 * section induk yang memuat judul golongannya.
 */
function sectionGolonganDari(tombolTutup: HTMLElement): Element | null {
  const sectionPanel = tombolTutup.closest('section');
  return sectionPanel?.parentElement?.closest('section') ?? null;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('panel fitur terbuka di dalam golongannya', () => {
  it('panel "Kelola MPP" berada di dalam golongan "Perencanaan Kebutuhan"', async () => {
    stub();
    renderPage();
    await bukaFaseSebelumKerja();

    const kartu = await screen.findByRole('button', { name: /Kelola MPP/i }, { timeout: 8000 });
    fireEvent.click(kartu);

    const tutup = await screen.findByRole('button', { name: /Tutup dan kembali ke daftar fitur/i }, { timeout: 8000 });
    const induk = sectionGolonganDari(tutup as HTMLElement);
    expect(induk, 'panel harus berada di dalam section golongan').toBeTruthy();
    expect(induk!.textContent || '').toMatch(/Perencanaan Kebutuhan/);
    expect(induk!.textContent || '').toMatch(/Kelola MPP/);
  });

  it('panel "Rekrutmen Kandidat" berada di dalam golongan "Seleksi & Rekrutmen"', async () => {
    stub();
    renderPage();
    await bukaFaseSebelumKerja();

    const kartu = await screen.findByRole('button', { name: /Rekrutmen Kandidat/i }, { timeout: 8000 });
    fireEvent.click(kartu);

    const tutup = await screen.findByRole('button', { name: /Tutup dan kembali ke daftar fitur/i }, { timeout: 8000 });
    const induk = sectionGolonganDari(tutup as HTMLElement);
    expect(induk).toBeTruthy();
    expect(induk!.textContent || '').toMatch(/Seleksi & Rekrutmen/);
  });

  it('panel tidak muncul di golongan lain', async () => {
    stub();
    renderPage();
    await bukaFaseSebelumKerja();

    const kartu = await screen.findByRole('button', { name: /Kelola MPP/i }, { timeout: 8000 });
    fireEvent.click(kartu);
    await screen.findByRole('button', { name: /Tutup dan kembali ke daftar fitur/i }, { timeout: 8000 });

    // Panel Kelola MPP hanya boleh ada SATU, di golongannya sendiri.
    const semuaTutup = screen.getAllByRole('button', { name: /Tutup dan kembali ke daftar fitur/i });
    expect(semuaTutup.length).toBe(1);
  });
});
