// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import HrOverviewAnalyticsPanel from '@/components/governance/HrOverviewAnalyticsPanel';
import HrLifecycleControlPanel from '@/components/governance/HrLifecycleControlPanel';

const okJson = (data: unknown) => ({ ok: true, json: async () => ({ status: 'success', data }) });

const profile = {
  headcount: { total: 9, active: 7, probation: 1, pkwt: 1, permanent: 5 },
  byDepartment: [
    { label: 'Information Technology', count: 5, percentage: 71.4 },
    { label: 'Human Resources', count: 2, percentage: 28.6 },
  ],
  byGender: [
    { label: 'Laki-laki', count: 5, percentage: 71.4 },
    { label: 'Perempuan', count: 2, percentage: 28.6 },
  ],
  byAgeBand: [
    { label: '25-34 tahun', count: 4, percentage: 57.1 },
    { label: 'Tidak diketahui', count: 3, percentage: 42.9 },
  ],
  byJobGrade: [{ label: 'G3', count: 7, percentage: 100 }],
  kpiAchievement: { averagePercentage: 94.5, belowTargetCount: 2, totalKpi: 4 },
  ratingDistribution: [
    { rating: 'A', count: 3, percentage: 75 },
    { rating: 'B', count: 1, percentage: 25 },
  ],
  mppFulfillment: { quota: 12, hired: 9, percentage: 75 },
};

const summary = {
  period_code: '2026-Q3',
  headcount: { total: 9, probation: 1, resigned: 2 },
  appraisal: { total_appraised: 1, average_gpa: 3.67, high_potential_count: 1 },
  benchmarks: { turnover_max: 3, vmai_target: 85 },
};

const lifecycle = {
  mpp_fulfillment_percentage: 75,
  average_quality_of_hire: 88.5,
  probation_conversion_percentage: 50,
};

const offboardings = [
  { id: 'o1', employeeName: 'Rizky Pratama', department: 'IT', lastWorkingDay: '2026-09-30', handoverProgress: 100 },
];

const activity = {
  items: [
    { id: 'a1', employeeName: 'Budi Pratama', eventType: 'KPI_DAILY', summary: 'mengisi KPI harian', occurredAt: '2026-09-24T08:00:00Z' },
  ],
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes('workforce-profile')) return okJson(profile);
    if (u.includes('executive-summary')) return okJson(summary);
    if (u.includes('lifecycle-summary')) return okJson(lifecycle);
    if (u.includes('offboarding/initiate')) return okJson(offboardings);
    if (u.includes('activity-feed/company')) return okJson(activity);
    if (u.includes('nine-box-distribution')) return okJson({ talent_quadrants: [] });
    return okJson({});
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('HrOverviewAnalyticsPanel (pilar 2 & 3)', () => {
  it('menampilkan headcount aktif, GPA, capaian KPI, dan pemenuhan MPP', async () => {
    render(<HrOverviewAnalyticsPanel />);
    await waitFor(() => expect(screen.getByText(/Headcount Aktif/)).toBeTruthy());
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('3.67')).toBeTruthy();
    expect(screen.getByText('94.5%')).toBeTruthy();
    expect(screen.getAllByText('75%').length).toBeGreaterThan(0);
  });

  it('menampilkan sebaran departemen, gender, usia, dan grade', async () => {
    render(<HrOverviewAnalyticsPanel />);
    await waitFor(() => expect(screen.getByText(/Sebaran per Departemen/)).toBeTruthy());
    expect(screen.getByText(/Information Technology/)).toBeTruthy();
    expect(screen.getByText(/Rasio Gender/)).toBeTruthy();
    expect(screen.getByText(/Sebaran Usia/)).toBeTruthy();
    expect(screen.getByText(/Sebaran Job Grade/)).toBeTruthy();
  });

  it('melaporkan kegagalan sumber data, bukan menampilkan nol palsu', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ detail: 'Server mati' }) })));
    render(<HrOverviewAnalyticsPanel />);
    await waitFor(() => expect(screen.getByText(/Gagal memuat analitik kepegawaian/)).toBeTruthy());
  });

  it('kurva distribusi memakai angka nyata, bukan contoh bawaan komponen', async () => {
    render(<HrOverviewAnalyticsPanel />);
    await waitFor(() => expect(screen.getByText(/Distribusi Nilai Performa/)).toBeTruthy());

    // Angka nyata dari ratingDistribution (75% dan 25%).
    expect(screen.getAllByText(/75%/).length).toBeGreaterThan(0);
    // Angka default komponen (58.5% / 16.8%) tidak boleh muncul.
    expect(screen.queryByText(/58\.5%/)).toBeNull();
    expect(screen.queryByText(/16\.8%/)).toBeNull();
  });

  it('label huruf pada kurva mengikuti rating sebenarnya (A bukan D)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('workforce-profile')) {
        return okJson({ ...profile, ratingDistribution: [{ rating: 'A', count: 3, percentage: 100 }] });
      }
      if (u.includes('executive-summary')) return okJson(summary);
      return okJson({ talent_quadrants: [] });
    }));

    render(<HrOverviewAnalyticsPanel />);
    await waitFor(() => expect(screen.getByText(/Distribusi Nilai Performa/)).toBeTruthy());

    // Data hanya berisi rating A: label SVG harus "A (100%)", bukan "D (100%)".
    expect(screen.getByText(/A \(100%\)/)).toBeTruthy();
    expect(screen.queryByText(/D \(100%\)/)).toBeNull();
  });

  it('menyatakan belum ada data bila distribusi rating kosong', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('workforce-profile')) return okJson({ ...profile, ratingDistribution: [] });
      if (u.includes('executive-summary')) return okJson(summary);
      return okJson({ talent_quadrants: [] });
    }));
    render(<HrOverviewAnalyticsPanel />);
    await waitFor(() =>
      expect(screen.getByText(/Belum ada data appraisal untuk menggambarkan distribusi/)).toBeTruthy()
    );
  });
});

describe('HrLifecycleControlPanel (pilar 1 & 6)', () => {
  it('menampilkan metrik pra-kerja secara default', async () => {
    render(<HrLifecycleControlPanel showPhaseSwitch />);
    await waitFor(() => expect(screen.getByText(/Pemenuhan MPP/)).toBeTruthy());
    expect(screen.getAllByText('75%').length).toBeGreaterThan(0);
    expect(screen.getByText('88.5')).toBeTruthy();
    expect(screen.getByText('50%')).toBeTruthy();
  });

  it('berpindah ke saat-kerja dan menampilkan ringkasan, tanpa log aktivitas duplikat', async () => {
    render(<HrLifecycleControlPanel showPhaseSwitch />);
    await waitFor(() => expect(screen.getAllByText(/Sebelum Kerja/)[0]).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /Saat Kerja/ }));
    await waitFor(() =>
      expect(screen.getByText(/Tahap 2 — Saat Kerja/i)).toBeTruthy()
    );
    // Log aktivitas penuh sudah ada di tab Ringkasan & Analitik.
    expect(screen.queryByText(/Log Aktivitas Terbaru/i)).toBeNull();
  });

  it('berpindah ke pasca-kerja dan menampilkan progres clearance', async () => {
    render(<HrLifecycleControlPanel showPhaseSwitch />);
    await waitFor(() => expect(screen.getAllByText(/Sebelum Kerja/)[0]).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /Setelah Kerja/ }));
    await waitFor(() => expect(screen.getByText(/Rizky Pratama/)).toBeTruthy());
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('tidak menampilkan entitas HTML mentah seperti &bull; pada keterangan', async () => {
    render(<HrLifecycleControlPanel showPhaseSwitch />);
    await waitFor(() => expect(screen.getAllByText(/Sebelum Kerja/)[0]).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /Setelah Kerja/ }));
    await waitFor(() => expect(screen.getByText(/Rizky Pratama/)).toBeTruthy());

    const body = document.body.textContent ?? '';
    expect(body).not.toContain('&bull;');
    expect(body).not.toContain('&amp;');
  });

  it('menangani nama karyawan duplikat tanpa error key React', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('lifecycle-summary')) return okJson(lifecycle);
      if (u.includes('offboarding/initiate')) {
        return okJson([
          { id: 'o1', employeeName: 'Hendra Gunawan', department: 'Dewan Direksi', lastWorkingDay: '2026-12-01', handoverProgress: 0 },
          { id: 'o2', employeeName: 'Hendra Gunawan', department: 'Dewan Direksi', lastWorkingDay: '2026-12-01', handoverProgress: 0 },
        ]);
      }
      if (u.includes('activity-feed/company')) return okJson(activity);
      return okJson({});
    }));

    const errors: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(String(args[0]));
    });

    render(<HrLifecycleControlPanel showPhaseSwitch />);
    await waitFor(() => expect(screen.getAllByText(/Sebelum Kerja/)[0]).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Setelah Kerja/ }));
    await waitFor(() => expect(screen.getAllByText(/Hendra Gunawan/).length).toBe(2));

    const duplicateKey = errors.filter((e) => e.includes('same key'));
    expect(duplicateKey).toEqual([]);
    spy.mockRestore();
  });
});
