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
  sampleSize: 4, overallAchievementPercentage: 69.6,
  measuredAchievementPercentage: 92.8,
  measurementCoveragePercentage: 75,
  measuredWeight: 75, totalWeight: 100,
  pillars: [
    { pillarId: 'p1', pillarName: 'Finansial', perspective: 'FINANCIAL',
      strategicWeight: 25, kpiCount: 1, achievementPercentage: 92.5,
      status: 'BELOW_TARGET', measured: true },
    { pillarId: 'p2', pillarName: 'Pelanggan', perspective: 'CUSTOMER',
      strategicWeight: 25, kpiCount: 0, achievementPercentage: 0,
      status: 'NO_DATA', measured: false },
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
  departments: [{ id: 'd1', name: 'IT', employeeCount: 1 }],
  bpjs: { totalRegistered: 3, totalPending: 1, totalMissing: 7,
    byClass: [{ className: 'Kelas 1', count: 2 }],
    employees: [{ employeeId: 'e1', employeeCode: 'EMP-0042', fullName: 'Budi Pratama',
      departmentId: 'd1', departmentName: 'IT',
      bpjsTkNumberMasked: '••••••••••••0123', bpjsKesNumberMasked: '••••••••••••0123',
      bpjsKesClass: 'Kelas 1', bpjsTkStatus: 'ACTIVE', bpjsKesStatus: 'ACTIVE' }] },
  overtime: { totalHours: 2, totalPay: 750000, pendingApprovals: 2,
    byDepartment: [{ departmentName: 'IT', hours: 2, pay: 750000 }] },
  operational: { totalAmount: 2550000,
    byCategory: [{ category: 'TRAVEL', count: 1, amount: 1250000 }],
    byStatus: [{ status: 'APPROVED', count: 1, amount: 1250000 }] },
  analysis: { costPerEmployee: 33927500, topDecileCostShare: 47.7,
      topDecileEmployeeCount: 1, topDecileStaffPercentage: 25,
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

    expect(screen.getByText('Kesehatan Perusahaan')).toBeTruthy();
    expect(screen.getByText('Arah Strategi & Saran AI')).toBeTruthy();
    expect(screen.getByText('Biaya & Gaji Karyawan')).toBeTruthy();
    expect(screen.getByText('Peta Talenta & Posisi Kunci')).toBeTruthy();
    expect(screen.getByText('Aktivitas & Kepatuhan Tim')).toBeTruthy();

    fireEvent.click(screen.getByText('Aktivitas & Kepatuhan Tim'));
    expect(onChange).toHaveBeenCalledWith('activity');
  });

  it('menampilkan tab e-Surat & Disposisi untuk BOD dan memanggil onChange keys', () => {
    const onChange = vi.fn();
    render(<BoardTabNav active="letters" onChange={onChange} />);
    expect(screen.getByText('e-Surat & Disposisi')).toBeTruthy();
    fireEvent.click(screen.getByText('Persetujuan MPP'));
    expect(onChange).toHaveBeenCalledWith('mpp-approval');
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

    it('tidak menampilkan nol saat respons 200 berenvelope tak terduga', async () => {
      // 200 tetapi bukan JSON/envelope sukses (mis. proxy mengembalikan HTML).
      vi.stubGlobal('fetch', vi.fn(async () => ({
        ok: true,
        json: async () => ({ unexpected: true }),
      })));
      render(<BoardActivityPanel />);
      await waitFor(() => expect(screen.getByText(/Gagal memuat aktivitas/)).toBeTruthy());
      expect(document.body.textContent ?? '').not.toMatch(/Total Aktivitas\s*0/);
    });

  it('tabel aktivitas terbaru memiliki filter departemen, sorting header, dan paginasi', async () => {
    render(<BoardActivityPanel />);
    await waitFor(() =>
      expect(screen.getByText('Catatan Log Aktivitas Terbaru')).toBeTruthy()
    );
    expect(screen.getByText('Pegawai')).toBeTruthy();
    expect(screen.getAllByText('Departemen').length).toBeGreaterThan(0);
    expect(screen.getByText('Jenis Aktivitas')).toBeTruthy();
    expect(screen.getByText('Ringkasan Aktivitas')).toBeTruthy();
    expect(screen.getByText('Waktu Kejadian (WIB)')).toBeTruthy();
  });
});

describe('BoardVisionPanel', () => {
  it('menampilkan visi, misi, capaian pilar, dan RJMP', async () => {
    render(<BoardVisionPanel />);
    await waitFor(() => expect(screen.getByText(/kelas dunia/)).toBeTruthy());
    expect(screen.getByText(/Misi satu/)).toBeTruthy();
    expect(screen.getByText(/CORP-FIN-01/)).toBeTruthy();
      // Muncul di badge status sekaligus di keterangan bobot pilar terkait.
      expect(screen.getAllByText(/Belum dinilai/).length).toBeGreaterThanOrEqual(1);
      // Pilar yang belum dinilai tidak boleh ditampilkan seolah capaian 0%.
      expect(screen.queryByText(/^0% • 0 KPI$/)).toBeNull();
      });

    it('memisahkan capaian resmi dari cakupan pengukuran', async () => {
      render(<BoardVisionPanel />);
      await waitFor(() => expect(screen.getByText(/kelas dunia/)).toBeTruthy());

      // Angka resmi tetap seluruh pilar (69,6), bukan renormalisasi (92,8).
      expect(screen.getByText(/Capaian Target Resmi/)).toBeTruthy();
      expect(screen.getByText('69.6%')).toBeTruthy();

      // Cakupan dan capaian terukur tampil terpisah agar tidak tertukar.
      expect(screen.getByText(/Cakupan target terukur/)).toBeTruthy();
      expect(screen.getByText('75%')).toBeTruthy();
      expect(screen.getByText(/Pada target yang sudah dinilai/)).toBeTruthy();
      expect(screen.getByText('92.8%')).toBeTruthy();
    });

  it('menampilkan temuan tata kelola dan register cascade', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('vision-achievement')) {
        return okJson({
          ...vision,
          cascadeGaps: [
            {
              corporateKpiId: 'c2', kpiCode: 'CORP-CUS-01', kpiName: 'Internal CSAT',
              pillarId: 'p2', pillarName: 'Pelanggan', pillarPerspective: 'CUSTOMER',
              templateCount: 4, coveredTemplateCount: 0,
              positionsMissingKpi: ['Chief Executive Officer', 'Head of Engineering & Ops'],
            },
          ],
          analysis: {
            ...vision.analysis,
            previousPeriodCode: '2026-Q2',
            governanceFindings: [
              {
                code: 'UNMEASURED_CONSECUTIVE_PERIODS', severity: 'GOVERNANCE',
                pillarId: 'p2', pillarName: 'Pelanggan', perspective: 'CUSTOMER',
                periods: ['2026-Q2', '2026-Q3'],
                message: 'Pilar Pelanggan tanpa KPI pada 2026-Q2 dan 2026-Q3.',
              },
            ],
          },
        });
      }
      return okJson({});
    }));

    render(<BoardVisionPanel />);
    await waitFor(() => expect(screen.getByText(/kelas dunia/)).toBeTruthy());

    expect(screen.getByText(/Temuan Tata Kelola/)).toBeTruthy();
    expect(screen.getByText(/tanpa KPI pada 2026-Q2 dan 2026-Q3/)).toBeTruthy();
    expect(screen.getByText(/CORP-CUS-01/)).toBeTruthy();
    expect(screen.getByText(/Chief Executive Officer/)).toBeTruthy();
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
    expect(screen.getAllByText(/(Perlu Pembinaan|PARTIAL)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/(Belum Memenuhi|NOT_COMPLIANT)/).length).toBeGreaterThan(0);
  });

  it('memiliki filter departemen, sorting header, dan paginasi pada tabel evaluasi karyawan', async () => {
    render(<BoardPositionFitPanel />);
    await waitFor(() =>
      expect(screen.getByText('Daftar Evaluasi Karyawan per Jabatan')).toBeTruthy()
    );
    // Header kolom
    expect(screen.getByText('Nama Pegawai')).toBeTruthy();
    expect(screen.getAllByText('Departemen').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Posisi Jabatan').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Status Kepatuhan').length).toBeGreaterThan(0);
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
        // Label konsentrasi biaya menyebut jumlah pegawai, bukan selalu "10%".
        expect(screen.getByText(/1 pegawai teratas \(25% staf\) = 47\.7% biaya/)).toBeTruthy();
  });

  it('tidak pernah menampilkan nomor BPJS 16 digit', async () => {
    render(<BoardCostPanel />);
    await waitFor(() =>
      expect(screen.getAllByText(/2026-09/).length).toBeGreaterThan(0)
    );
    const body = document.body.textContent ?? '';
    expect(body).not.toMatch(/\d{16}/);
  });

    it('memuat halaman rincian berikutnya lewat kontrol paginasi', async () => {
      const urls: string[] = [];
      vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        urls.push(String(url));
        const page = new URL(String(url), 'http://localhost').searchParams.get('page');
        if (String(url).includes('board-cost')) {
          return okJson({
            ...cost,
            employees: [
              {
                ...cost.employees[0],
                employeeId: `e-page-${page ?? 1}`,
                fullName: page === '2' ? 'Karyawan Halaman Dua' : 'Budi Pratama',
              },
            ],
            employeesPagination: { page: Number(page ?? 1), pageSize: 50, total: 120 },
          });
        }
        return okJson({});
      }));

      render(<BoardCostPanel />);
      await waitFor(() =>
        expect(
          screen.getAllByText((_, node) => Boolean(node?.textContent?.includes('Halaman 1 dari'))).length
        ).toBeGreaterThan(0)
      );

      fireEvent.click(screen.getAllByRole('button', { name: /Halaman Berikutnya/i })[0]);
      await waitFor(() => expect(screen.getByText(/Karyawan Halaman Dua/)).toBeTruthy());
      expect(urls.some((u) => u.includes('page=2'))).toBe(true);
      expect(
        screen.getAllByText((_, node) => Boolean(node?.textContent?.includes('Halaman 2 dari'))).length
      ).toBeGreaterThan(0);

      fireEvent.click(screen.getAllByRole('button', { name: /Halaman Sebelumnya/i })[0]);
      await waitFor(() =>
        expect(
          screen.getAllByText((_, node) => Boolean(node?.textContent?.includes('Halaman 1 dari'))).length
        ).toBeGreaterThan(0)
      );
      expect(urls.some((u) => u.includes('page=1'))).toBe(true);
    });

    it('tabel BPJS memiliki filter departemen, sorting header, dan paginasi', async () => {
      render(<BoardCostPanel />);
      await waitFor(() =>
        expect(screen.getByText(/Kepesertaan Jaminan Sosial BPJS/)).toBeTruthy()
      );
      // Badge jumlah pegawai BPJS
      expect(screen.getByText(/1 dari 1 Pegawai/)).toBeTruthy();
      // Kolom Departemen di tabel BPJS
      expect(screen.getAllByText('Departemen').length).toBeGreaterThan(0);
      // Header kolom
      expect(screen.getByText('No. BPJS Ketenagakerjaan')).toBeTruthy();
      expect(screen.getByText('No. BPJS Kesehatan')).toBeTruthy();
      // Baris data dengan nama IT
      expect(screen.getAllByText('IT').length).toBeGreaterThan(0);
    });
  });

describe('Executive Boardroom page', () => {
  const pageUrl = 'http://localhost:3000/dashboard/executive';

  it('merender lima tab dan berpindah ke panel aktivitas', async () => {
    window.history.replaceState({}, '', '/dashboard/executive');
    const Page = (await import('@/app/dashboard/executive/page')).default;

    render(<Page />);
    await waitFor(() => expect(screen.getByText('Aktivitas & Kepatuhan Tim')).toBeTruthy());

    fireEvent.click(screen.getByText('Aktivitas & Kepatuhan Tim'));
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
