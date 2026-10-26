// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import BoardTabNav from '@/components/executive/BoardTabNav';
import BoardActivityPanel from '@/components/executive/BoardActivityPanel';
import BoardVisionPanel from '@/components/executive/BoardVisionPanel';
import BoardPositionFitPanel from '@/components/executive/BoardPositionFitPanel';
import BoardCostPanel from '@/components/executive/BoardCostPanel';

const okJson = (data: unknown) => ({ ok: true, json: async () => ({ status: 'success', data }) });

const activity = {
  fromDate: '2026-09-19', toDate: '2026-09-24', sampleSize: 11, totalEvents: 11,
  byEventType: [{ eventType: 'KPI_DAILY', count: 3, percentage: 27.3 }],
  byDepartment: [{ departmentName: 'IT', count: 8 }],
  byOwnerRole: [{ role: 'EMPLOYEE', count: 6, percentage: 54.5 }],
  dailyTrend: [{ date: '2026-09-24', count: 3 }],
  recent: [{ id: 'a1', employeeName: 'Budi Pratama', employeeCode: 'EMP-0042',
    departmentName: 'IT', eventType: 'KPI_DAILY', summary: 'Mengisi KPI harian',
    occurredAt: '2026-09-24T02:30:00.000Z' }],
  analysis: { busiestDepartment: 'IT', busiestEventType: 'KPI_DAILY',
    coveragePercentage: 50, activeEmployees: 10, highlights: ['11 aktivitas tercatat.'] },
};

const vision = {
  vision: 'Menjadi perusahaan kelas dunia.', missions: ['Misi satu', 'Misi dua'],
  sampleSize: 4, overallAchievementPercentage: 92.8,
  pillars: [
    { pillarId: 'p1', pillarName: 'Finansial', perspective: 'FINANCIAL',
      strategicWeight: 25, kpiCount: 1, achievementPercentage: 92.5, status: 'BELOW_TARGET' },
    { pillarId: 'p2', pillarName: 'Pelanggan', perspective: 'CUSTOMER',
      strategicWeight: 25, kpiCount: 0, achievementPercentage: 0, status: 'NO_DATA' },
  ],
  rjmp: [{ corporateKpiId: 'c1', kpiCode: 'CORP-FIN-01', kpiName: 'Revenue Growth',
    periodYear: 2026, targetValue: 15, unit: '%', derivedAchievementPercentage: 92.5,
    status: 'BELOW_TARGET' }],
  analysis: { achievedPillarCount: 0, belowTargetPillarCount: 1, noDataPillarCount: 1,
    weakestPillar: 'Finansial', strongestPillar: 'Finansial', highlights: ['Capaian 92.8%.'] },
};

const fit = {
  sampleSize: 10,
  byPosition: [{ positionId: 'pos1', positionTitle: 'Senior Software Engineer',
    jobGrade: 'G4', holders: 4, compliantHolders: 1, templateKpiCount: 3, matchedKpiCount: 1,
    coveragePercentage: 42.5, achievementPercentage: 90, status: 'PARTIAL' }],
  employees: [{ employeeId: 'e1', employeeCode: 'EMP-0042', fullName: 'Budi Pratama',
    departmentName: 'IT', positionId: 'pos1', positionTitle: 'Senior Software Engineer',
    jobGrade: 'G4', templateKpiCount: 3, matchedKpiCount: 0, coveragePercentage: 0,
    achievementPercentage: 0, latestGpa: 3.67, latestRating: 'A', status: 'NOT_COMPLIANT' }],
  analysis: { compliantPositions: 1, positionsWithoutTemplate: 2,
    averageCoveragePercentage: 42.5, highlights: ['1 dari 8 posisi sesuai template.'] },
};

const cost = {
  sampleSize: 4,
  payroll: {
    runs: [{ runId: 'r1', periodCode: '2026-09', status: 'APPROVED', totalGross: 150250000,
      totalDeductions: 14540000, totalNet: 135710000, employeeCount: 4, approvedAt: null }],
    latest: { runId: 'r1', periodCode: '2026-09', totalGross: 150250000, totalNet: 135710000 },
    trend: [{ periodCode: '2026-09', totalNet: 135710000, deltaPercentage: null }],
  },
  employees: [{ employeeId: 'e1', employeeCode: 'EMP-0042', fullName: 'Budi Pratama',
    departmentName: 'IT', positionTitle: 'Senior Software Engineer', baseSalary: 28500000,
    fixedAllowance: 2500000, overtimePay: 750000, bpjsKesehatan: 285000, bpjsJht: 570000,
    bpjsJp: 285000, pph21: 1500000, gross: 31750000, totalDeductions: 2640000,
    net: 29110000, overtimeHours: 2 }],
  employeesPagination: { page: 1, pageSize: 50, total: 4 },
  bpjs: { totalRegistered: 3, totalPending: 1, totalMissing: 7,
    byClass: [{ className: 'Kelas 1', count: 2 }],
    employees: [{ employeeId: 'e1', employeeCode: 'EMP-0042', fullName: 'Budi Pratama',
      bpjsTkNumberMasked: '••••••••••••0123', bpjsKesNumberMasked: '••••••••••••0123',
      bpjsKesClass: 'Kelas 1', bpjsTkStatus: 'ACTIVE', bpjsKesStatus: 'ACTIVE' }] },
  overtime: { totalHours: 2, totalPay: 750000, pendingApprovals: 2,
    byDepartment: [{ departmentName: 'IT', hours: 2, pay: 750000 }] },
  operational: { totalAmount: 2550000,
    byCategory: [{ category: 'TRAVEL', count: 1, amount: 1250000 }],
    byStatus: [{ status: 'APPROVED', count: 1, amount: 1250000 }] },
  analysis: { costPerEmployee: 33927500, topDecileCostShare: 47.7,
    payrollGrowthPercentage: 0.56,
    highlights: ['Payroll 2026-09 net 135.710.000 untuk 4 pegawai.',
      '10% pegawai termahal menyerap 47.7% total biaya.',
      '2 pengajuan lembur menunggu persetujuan.'] },
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes('board-activity')) return okJson(activity);
    if (u.includes('vision-achievement')) return okJson(vision);
    if (u.includes('position-fit')) return okJson(fit);
    if (u.includes('board-cost')) return okJson(cost);
    if (u.includes('board-analysis')) {
      return { ok: true, json: async () => ({ status: 'success', data: {
        insight: 'Ringkasan AI.', provider: 'groq', generatedAt: '2026-10-26T00:00:00.000Z',
        fromCache: false, configured: true } }) };
    }
    return okJson({});
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('BoardTabNav', () => {
  it('merender lima tab dan memanggil onChange saat diklik', async () => {
    const onChange = vi.fn();
    render(<BoardTabNav active="overview" onChange={onChange} />);

    expect(screen.getByText('Ringkasan VMAI & BSC')).toBeTruthy();
    expect(screen.getByText('Aktivitas Semua Profil')).toBeTruthy();
    expect(screen.getByText('Visi-Misi & Analisis AI')).toBeTruthy();
    expect(screen.getByText('Kesesuaian Posisi & RJMP')).toBeTruthy();
    expect(screen.getByText('Payroll, BPJS & Biaya')).toBeTruthy();

    fireEvent.click(screen.getByText('Aktivitas Semua Profil'));
    expect(onChange).toHaveBeenCalledWith('activity');
  });
});

describe('BoardActivityPanel', () => {
  it('menampilkan analisis dan rincian aktivitas', async () => {
    render(<BoardActivityPanel />);
    await waitFor(() => expect(screen.getByText(/11 aktivitas tercatat/)).toBeTruthy());
    expect(screen.getByText(/Budi Pratama/)).toBeTruthy();
    // KPI_DAILY muncul di ringkasan tipe sekaligus di tabel terbaru.
    expect(screen.getAllByText(/KPI_DAILY/).length).toBeGreaterThan(0);
  });

  it('menampilkan pesan gagal tanpa angka saat API gagal', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      json: async () => ({ detail: 'Server mati' }),
    })));
    render(<BoardActivityPanel />);
    await waitFor(() => expect(screen.getByText(/Gagal memuat aktivitas/)).toBeTruthy());
    expect(screen.queryByText(/11 aktivitas tercatat/)).toBeNull();
  });
});

describe('BoardVisionPanel', () => {
  it('menampilkan visi, misi, capaian pilar, dan RJMP', async () => {
    render(<BoardVisionPanel />);
    await waitFor(() => expect(screen.getByText(/kelas dunia/)).toBeTruthy());
    expect(screen.getByText(/Misi satu/)).toBeTruthy();
    expect(screen.getByText(/CORP-FIN-01/)).toBeTruthy();
    expect(screen.getByText(/Belum ada KPI/)).toBeTruthy();
  });

  it('tidak memanggil AI secara otomatis saat mount', async () => {
    const spy = vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('vision-achievement')) return okJson(vision);
      return okJson({});
    });
    vi.stubGlobal('fetch', spy);

    render(<BoardVisionPanel />);
    await waitFor(() => expect(screen.getByText(/kelas dunia/)).toBeTruthy());

    const called = spy.mock.calls.some(([u]) => String(u).includes('board-analysis'));
    expect(called).toBe(false);
  });

  it('menjalankan analisis AI hanya setelah tombol ditekan', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('board-analysis')) {
        return {
          ok: true,
          json: async () => ({
            status: 'success',
            data: {
              insight: 'Ringkasan AI.',
              provider: 'groq',
              generatedAt: '2026-10-26T00:00:00.000Z',
              fromCache: false,
              configured: true,
            },
          }),
        };
      }
      if (u.includes('vision-achievement')) return okJson(vision);
      return okJson({});
    }));

    render(<BoardVisionPanel />);
    await waitFor(() => expect(screen.getByText(/kelas dunia/)).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /Analisis AI/ }));
    await waitFor(() => expect(screen.getByText(/Ringkasan AI/)).toBeTruthy());
  });
});

describe('BoardPositionFitPanel', () => {
  it('menampilkan status kepatuhan posisi dan pegawai', async () => {
    render(<BoardPositionFitPanel />);
    // Nama posisi muncul di ringkasan posisi sekaligus di rincian pegawai.
    await waitFor(() =>
      expect(screen.getAllByText(/Senior Software Engineer/).length).toBeGreaterThan(0)
    );
    expect(screen.getByText(/PARTIAL/)).toBeTruthy();
    expect(screen.getByText(/NOT_COMPLIANT/)).toBeTruthy();
  });
});

describe('BoardCostPanel', () => {
  it('menampilkan payroll, BPJS ter-masking, lembur, dan biaya operasional', async () => {
    render(<BoardCostPanel />);
    // Periode muncul di kartu metrik sekaligus di highlight analisis.
    await waitFor(() =>
      expect(screen.getAllByText(/2026-09/).length).toBeGreaterThan(0)
    );
    // Nomor BPJS tampil di dua kolom (TK dan Kesehatan).
    expect(screen.getAllByText('••••••••••••0123').length).toBe(2);
    expect(screen.getByText(/TRAVEL/)).toBeTruthy();
    expect(screen.getByText(/2 pengajuan lembur menunggu/)).toBeTruthy();
  });

  it('tidak pernah menampilkan nomor BPJS 16 digit', async () => {
    render(<BoardCostPanel />);
    await waitFor(() =>
      expect(screen.getAllByText(/2026-09/).length).toBeGreaterThan(0)
    );
    const body = document.body.textContent ?? '';
    expect(body).not.toMatch(/\d{16}/);
  });
});

describe('Executive Boardroom page', () => {
  const pageUrl = 'http://localhost:3000/dashboard/executive';

  it('merender lima tab dan berpindah ke panel aktivitas', async () => {
    window.history.replaceState({}, '', '/dashboard/executive');
    const Page = (await import('@/app/dashboard/executive/page')).default;

    render(<Page />);
    await waitFor(() => expect(screen.getByText('Aktivitas Semua Profil')).toBeTruthy());

    fireEvent.click(screen.getByText('Aktivitas Semua Profil'));
    await waitFor(() => expect(screen.getByText(/11 aktivitas tercatat/)).toBeTruthy());
  });

  it('membuka tab vision lewat deep-link ?tab=vision', async () => {
    window.history.replaceState({}, '', '/dashboard/executive?tab=vision');
    const Page = (await import('@/app/dashboard/executive/page')).default;

    render(<Page />);
    await waitFor(() => expect(screen.getByText(/kelas dunia/)).toBeTruthy());
    expect(screen.queryByText(/11 aktivitas tercatat/)).toBeNull();
  });

  it('menampilkan banner gagal tanpa memakai angka cadangan saat scorecard gagal', async () => {
    window.history.replaceState({}, '', '/dashboard/executive');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('vmai-scorecard')) {
        return { ok: false, json: async () => ({ detail: 'Scorecard mati' }) };
      }
      return okJson({});
    }));

    const Page = (await import('@/app/dashboard/executive/page')).default;
    render(<Page />);

    await waitFor(() =>
      expect(screen.getByText(/Gagal memuat scorecard eksekutif: Scorecard mati/)).toBeTruthy()
    );
    // Tidak ada angka apa pun yang dirender saat gagal — termasuk pil GCG
    // "Faktor 1.00" yang dulu bertahan di luar guard.
    expect(screen.queryByText(/Faktor 1\.00/)).toBeNull();
    expect(screen.queryByText(/Terverifikasi/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Unduh Ringkasan Eksekutif/ })).toBeNull();
    expect(document.body.textContent ?? '').not.toMatch(/\d+([.,]\d+)?%/);
  });
});
