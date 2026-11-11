// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import TargetAchievementCard from '@/components/performance/TargetAchievementCard';

const mockTeamData = {
  role: 'PEOPLE_MANAGER',
  scopeLevel: 'TEAM',
  periodId: 'd0000000-0000-4000-8000-000000000001',
  periodCode: '2026-Q3',
  overallPercentage: 88.5,
  status: 'ON_TRACK',
  statusLabel: 'Sesuai Jalur (88.5%)',
  statusColor: {
    text: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    bar: 'bg-blue-500',
  },
  targetCount: 8,
  achievedCount: 5,
  summary: {
    totalEntities: 3,
    totalKpis: 8,
    exceededCount: 4,
    onTrackCount: 2,
    atRiskCount: 1,
    criticalCount: 1,
  },
  teamMembers: [
    {
      employeeId: 'b0000000-0000-4000-8000-000000000004',
      fullName: 'Budi Pratama',
      employeeCode: 'EMP-2022-0042',
      position: 'Senior Software Engineer',
      department: 'Technology',
      achievementPercentage: 104.2,
      kpiCount: 4,
      status: 'EXCEEDED',
    },
    {
      employeeId: 'b0000000-0000-4000-8000-000000000007',
      fullName: 'Anisa Wijaya',
      employeeCode: 'EMP-2023-0108',
      position: 'Product Designer',
      department: 'Technology',
      achievementPercentage: 78.5,
      kpiCount: 4,
      status: 'AT_RISK',
    },
  ],
  myOwn: {
    overallPercentage: 92.0,
    status: 'ON_TRACK',
    kpiCount: 4,
  },
};

const mockBudiIndividualData = {
  role: 'PEOPLE_MANAGER',
  scopeLevel: 'INDIVIDUAL',
  periodId: 'd0000000-0000-4000-8000-000000000001',
  periodCode: '2026-Q3',
  overallPercentage: 104.2,
  status: 'EXCEEDED',
  statusLabel: 'Melampaui Target (104.2%)',
  statusColor: {
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    bar: 'bg-emerald-500',
  },
  targetCount: 4,
  achievedCount: 3,
  summary: {
    totalEntities: 1,
    totalKpis: 4,
    exceededCount: 3,
    onTrackCount: 1,
    atRiskCount: 0,
    criticalCount: 0,
  },
  employeeInfo: {
    employeeId: 'b0000000-0000-4000-8000-000000000004',
    fullName: 'Budi Pratama',
    employeeCode: 'EMP-2022-0042',
    position: 'Senior Software Engineer',
    department: 'Technology',
  },
  individualKpis: [
    {
      id: 'kpi-1',
      title: 'SLA Keandalan Sistem 99.9%',
      targetValue: 99.9,
      actualValue: 99.95,
      unit: '%',
      weight: 30,
      achievementPercentage: 105.0,
      status: 'EXCEEDED',
      pillarName: 'Keunggulan Operasional & Zero Fatal SOP',
    },
    {
      id: 'kpi-2',
      title: 'Penyelesaian Refactoring Core Architecture',
      targetValue: 10,
      actualValue: 10,
      unit: 'modul',
      weight: 25,
      achievementPercentage: 100.0,
      status: 'EXCEEDED',
      pillarName: 'Kapabilitas Human Capital',
    },
  ],
};

const mockOrgData = {
  role: 'HR_MANAGER',
  scopeLevel: 'ORGANIZATION',
  periodId: 'd0000000-0000-4000-8000-000000000001',
  periodCode: '2026-Q3',
  overallPercentage: 86.4,
  status: 'ON_TRACK',
  statusLabel: 'Sesuai Jalur (86.4%)',
  statusColor: {
    text: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    bar: 'bg-blue-500',
  },
  targetCount: 24,
  achievedCount: 18,
  summary: {
    totalEntities: 15,
    totalKpis: 24,
    exceededCount: 10,
    onTrackCount: 8,
    atRiskCount: 4,
    criticalCount: 2,
  },
  departments: [
    {
      departmentId: 'dept-tech',
      departmentName: 'Technology & Engineering',
      averagePercentage: 91.2,
      employeeCount: 6,
      kpiCount: 14,
      status: 'ON_TRACK',
    },
  ],
  teamMembers: [
    {
      employeeId: 'b0000000-0000-4000-8000-000000000004',
      fullName: 'Budi Pratama',
      employeeCode: 'EMP-2022-0042',
      position: 'Senior Software Engineer',
      department: 'Technology & Engineering',
      achievementPercentage: 104.2,
      kpiCount: 4,
      status: 'EXCEEDED',
    },
  ],
};

describe('TargetAchievementCard Drill-Down & Breadcrumb (People Manager, HR, BOD)', () => {
  let fetchMock: any;

  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('employee_id=b0000000-0000-4000-8000-000000000004')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockBudiIndividualData }),
        });
      }
      if (url.includes('department_id=dept-tech')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockOrgData }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: mockTeamData }),
      });
    });
    global.fetch = fetchMock;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('menampilkan daftar anggota tim dan tombol Lihat Target untuk People Manager', async () => {
    render(<TargetAchievementCard periodId="d0000000-0000-4000-8000-000000000001" />);

    await waitFor(() => {
      expect(screen.getByText('Budi Pratama')).toBeTruthy();
      expect(screen.getByText('Anisa Wijaya')).toBeTruthy();
    });

    const lihatButtons = screen.getAllByRole('button', { name: /Lihat Target/i });
    expect(lihatButtons.length).toBe(2);
  });

  it('mengaktifkan mode drill-down dengan breadcrumb saat mengklik Lihat Target karyawan', async () => {
    render(<TargetAchievementCard periodId="d0000000-0000-4000-8000-000000000001" />);

    await waitFor(() => {
      expect(screen.getByText('Budi Pratama')).toBeTruthy();
    });

    const budiButton = screen.getAllByRole('button', { name: /Lihat Target/i })[0];
    fireEvent.click(budiButton);

    await waitFor(() => {
      // Breadcrumb muncul
      expect(screen.getByText('Ikhtisar Tim')).toBeTruthy();
      expect(screen.getByText('Mode Individu')).toBeTruthy();
      expect(screen.getByText('SLA Keandalan Sistem 99.9%')).toBeTruthy();
      expect(screen.getByText('Penyelesaian Refactoring Core Architecture')).toBeTruthy();
    });

    // Periksa tautan ke profil lengkap pegawai
    const linkProfil = screen.getByRole('link', { name: /Profil Lengkap/i });
    expect(linkProfil.getAttribute('href')).toContain(
      '/dashboard/employees/b0000000-0000-4000-8000-000000000004?tab=kinerja'
    );
  });

  it('dapat kembali ke tampilan tim melalui tombol breadcrumb', async () => {
    render(<TargetAchievementCard periodId="d0000000-0000-4000-8000-000000000001" />);

    await waitFor(() => {
      expect(screen.getByText('Budi Pratama')).toBeTruthy();
    });

    const budiButton = screen.getAllByRole('button', { name: /Lihat Target/i })[0];
    fireEvent.click(budiButton);

    await waitFor(() => {
      expect(screen.getByText('Mode Individu')).toBeTruthy();
    });

    // Klik tombol kembali di breadcrumb
    const kembaliButton = screen.getByRole('button', { name: /Ikhtisar Tim/i });
    fireEvent.click(kembaliButton);

    await waitFor(() => {
      expect(screen.queryByText('Mode Individu')).toBeNull();
      expect(screen.getByText('Capaian Anggota Tim (2)')).toBeTruthy();
    });
  });

  it('mendukung filter pencarian cepat anggota tim', async () => {
    render(<TargetAchievementCard periodId="d0000000-0000-4000-8000-000000000001" />);

    await waitFor(() => {
      expect(screen.getByText('Budi Pratama')).toBeTruthy();
      expect(screen.getByText('Anisa Wijaya')).toBeTruthy();
    });

    // Ketik di input pencarian
    const inputSearch = screen.getByPlaceholderText(/Cari nama atau jabatan/i);
    fireEvent.change(inputSearch, { target: { value: 'Designer' } });

    await waitFor(() => {
      expect(screen.queryByText('Budi Pratama')).toBeNull();
      expect(screen.getByText('Anisa Wijaya')).toBeTruthy();
    });
  });

  it('mendukung drill-down karyawan di departemen terpilih untuk peran HR / Organisasi', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('employee_id=b0000000-0000-4000-8000-000000000004')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockBudiIndividualData }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: mockOrgData }),
      });
    });

    render(
      <TargetAchievementCard
        departmentId="dept-tech"
        periodId="d0000000-0000-4000-8000-000000000001"
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText('Technology & Engineering').length).toBeGreaterThan(0);
      expect(screen.getByText('Budi Pratama')).toBeTruthy();
    });

    const lihatBtn = screen.getByRole('button', { name: /Lihat Target/i });
    fireEvent.click(lihatBtn);

    await waitFor(() => {
      expect(screen.getByText('Mode Individu')).toBeTruthy();
      expect(screen.getByText(/Dept\. Technology & Engineering/i)).toBeTruthy();
      expect(screen.getByText('SLA Keandalan Sistem 99.9%')).toBeTruthy();
    });

    // Kembali ke departemen
    const kembaliBtn = screen.getByRole('button', { name: /Dept\. Technology & Engineering/i });
    fireEvent.click(kembaliBtn);

    await waitFor(() => {
      expect(screen.queryByText('Mode Individu')).toBeNull();
      expect(screen.getAllByText('Technology & Engineering').length).toBeGreaterThan(0);
    });
  });
});
