// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import WorkloadAnalysisPanel from '@/components/governance/WorkloadAnalysisPanel';
import CareerAndActionsPanel from '@/components/governance/CareerAndActionsPanel';
import PkwtDirectoryPanel from '@/components/governance/PkwtDirectoryPanel';

const okJson = (data: unknown) => ({ ok: true, json: async () => ({ status: 'success', data }) });

const workload = {
  fromDate: '2026-09-21',
  toDate: '2026-09-24',
  capacityHours: 32,
  averageHours: 21.8,
  averageIntensity: 68,
  overUtilizedCount: 1,
  underUtilizedCount: 1,
  optimalCount: 0,
  noDataCount: 1,
  employees: [
    { employeeId: 'e1', employeeCode: 'EMP-001', fullName: 'Budi Pratama', departmentName: 'IT',
      totalRegularHours: 24, totalOvertimeHours: 11.5, totalHours: 35.5, entryCount: 3,
      capacityHours: 32, workloadIntensityPercentage: 111, status: 'OVER_UTILIZED' },
    { employeeId: 'e2', employeeCode: 'EMP-002', fullName: 'Anisa Wijaya', departmentName: 'IT',
      totalRegularHours: 8, totalOvertimeHours: 0, totalHours: 8, entryCount: 1,
      capacityHours: 32, workloadIntensityPercentage: 25, status: 'UNDER_UTILIZED' },
    { employeeId: 'e3', employeeCode: 'MGR-001', fullName: 'Raden Mas Danu', departmentName: 'IT',
      totalRegularHours: 0, totalOvertimeHours: 0, totalHours: 0, entryCount: 0,
      capacityHours: 32, workloadIntensityPercentage: 0, status: 'NO_DATA' },
  ],
};

const recommendations = [
  { id: 'contract-e9', type: 'CONTRACT_EXPIRY', priority: 'HIGH',
    title: 'Kontrak PKWT Rian Hidayat Segera Berakhir',
    description: 'Sisa masa kontrak: 20 hari.', actionUrl: '/dashboard/hr-command?tab=directory',
    actionLabel: 'Tinjau Kontrak' },
  { id: 'promotion-e1', type: 'PROMOTION_READINESS', priority: 'LOW',
    title: 'Budi Pratama Siap Promosi ke Manager IT',
    description: 'Kesiapan 100%.', actionUrl: '/api/v1/hr/career-guidance/e1',
    actionLabel: 'Lihat Panduan Karir' },
];

const contracts = {
  referenceDate: '2026-10-25',
  totalPkwt: 2,
  expiringIn30Days: 1,
  expiringIn60Days: 0,
  expiredCount: 1,
  missingEndDateCount: 0,
  alerts: [
    { employeeId: 'e9', employeeCode: 'EMP-2024-0230', fullName: 'Rian Hidayat',
      departmentName: 'IT', positionTitle: 'Staff IT', contractEndDate: '2026-11-14',
      daysRemaining: 20, urgency: 'CRITICAL_30' },
    { employeeId: 'e10', employeeCode: 'EMP-2023-0108', fullName: 'Dewi Lestari',
      departmentName: 'Finance', positionTitle: 'Analis', contractEndDate: '2026-10-01',
      daysRemaining: -24, urgency: 'EXPIRED' },
  ],
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).includes('workload-summary')) return okJson(workload);
    if (String(url).includes('action-recommendations')) return okJson(recommendations);
    if (String(url).includes('contracts-summary')) return okJson(contracts);
    return okJson({});
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('WorkloadAnalysisPanel', () => {
  it('menampilkan kapasitas periode nyata, bukan asumsi 160 jam', async () => {
    render(<WorkloadAnalysisPanel />);
    await waitFor(() => expect(screen.getByText(/Budi Pratama/)).toBeTruthy());
    expect(screen.getByText(/32 jam/i)).toBeTruthy();
    expect(screen.queryByText(/160 Jam/i)).toBeNull();
  });

  it('membedakan NO_DATA dari UNDER_UTILIZED', async () => {
    render(<WorkloadAnalysisPanel />);
    await waitFor(() => expect(screen.getByText(/Budi Pratama/)).toBeTruthy());
    // Setiap status punya tombol filter + badge baris, jadi keduanya muncul >1 kali.
    for (const label of [/Tanpa data/, /Kurang beban/, /Beban berlebih/]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(1);
    }
    // Baris tanpa data tidak boleh dihitung sebagai kurang beban pada kartu metrik.
    expect(screen.getByText(/Tidak dihitung under-utilized/)).toBeTruthy();
  });
});

describe('CareerAndActionsPanel', () => {
  it('merender rekomendasi dengan prioritas dan tautan tindakan', async () => {
    render(<CareerAndActionsPanel />);
    await waitFor(() =>
      expect(screen.getByText(/Kontrak PKWT Rian Hidayat/)).toBeTruthy()
    );
    expect(screen.getByText(/Siap Promosi/)).toBeTruthy();
    expect(screen.getByText('2 Rekomendasi Terbuka')).toBeTruthy();
  });

  it('menampilkan kesiapan jenjang karir saat employeeId dipilih', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('career-guidance')) {
        return okJson({
          employeeId: 'e1',
          fullName: 'Budi Pratama',
          currentPositionId: 'p1',
          currentPositionTitle: 'Staff IT',
          currentJobGrade: 'G3',
          serviceMonths: 54,
          currentGpa: 3.67,
          nextCareerPaths: [
            { targetPositionId: 'p2', targetPositionTitle: 'Manager IT', targetJobGrade: 'G5',
              minServiceMonths: 36, currentServiceMonths: 54, isServiceMet: true,
              minGpa: 3.25, currentGpa: 3.67, isGpaMet: true,
              requiredSkills: ['Leadership'], missingSkills: ['Leadership'],
              readinessPercentage: 100, isEligibleForPromotion: true },
          ],
        });
      }
      if (String(url).includes('action-recommendations')) return okJson(recommendations);
      return okJson({});
    }));

    render(<CareerAndActionsPanel employeeId="e1" />);
    await waitFor(() => expect(screen.getByText(/Panduan Jenjang Karir/)).toBeTruthy());
    expect(screen.getAllByText(/Manager IT/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/GPA 3\.67/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Kesiapan 100%/).length).toBeGreaterThan(0);
  });

  it('menampilkan keadaan kosong tanpa error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okJson([])));
    render(<CareerAndActionsPanel />);
    await waitFor(() =>
      expect(screen.getByText(/Tidak ada aksi kritis/)).toBeTruthy()
    );
  });
});

describe('PkwtDirectoryPanel', () => {
  it('menampilkan ringkasan kontrak dan menyaring berdasarkan pencarian', async () => {
    render(<PkwtDirectoryPanel />);
    await waitFor(() => expect(screen.getByText(/Rian Hidayat/)).toBeTruthy());
    expect(screen.getByText('2')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/Cari nama/), {
      target: { value: 'Dewi' },
    });
    await waitFor(() => expect(screen.queryByText(/Rian Hidayat/)).toBeNull());
    expect(screen.getByText(/Dewi Lestari/)).toBeTruthy();
  });

  it('menyaring kontrak kedaluwarsa', async () => {
    render(<PkwtDirectoryPanel />);
    await waitFor(() => expect(screen.getByText(/Rian Hidayat/)).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /Kedaluwarsa/ }));
    await waitFor(() => expect(screen.queryByText(/Rian Hidayat/)).toBeNull());
    expect(screen.getByText(/Dewi Lestari/)).toBeTruthy();
  });
});
