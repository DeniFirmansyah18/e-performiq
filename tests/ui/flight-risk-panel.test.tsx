// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import FlightRiskHeatmap from '@/components/governance/FlightRiskHeatmap';

const withRisks = {
  ok: true,
  status: 200,
  json: async () => ({
    status: 'success',
    data: {
      total: 2,
      items: [
        {
          employeeId: 'e1', fullName: 'Budi Pratama', departmentName: 'Operasional',
          attritionScore: 85, attritionBand: 'CRITICAL',
          burnoutScore: 72, burnoutBand: 'HIGH',
          factors: [
            { code: 'ABSENCE', label: 'Ketidakhadiran 30 hari', points: 30, maxPoints: 30 },
            { code: 'OVERTIME_LOAD', label: 'Beban lembur 30 hari', points: 40, maxPoints: 40 },
          ],
          snapshotDate: '2026-10-20',
        },
        {
          employeeId: 'e2', fullName: 'Siti Aminah', departmentName: 'Keuangan',
          attritionScore: 10, attritionBand: 'LOW',
          burnoutScore: 0, burnoutBand: 'LOW',
          factors: [],
          snapshotDate: '2026-10-20',
        },
      ],
    },
  }),
};

const empty = {
  ok: true,
  status: 200,
  json: async () => ({ status: 'success', data: { total: 0, items: [] } }),
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => withRisks));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('FlightRiskHeatmap', () => {
  it('menampilkan dua skor (attrition & burnout) per karyawan', async () => {
    render(<FlightRiskHeatmap />);

    await waitFor(() => expect(screen.getByText('Budi Pratama')).toBeTruthy());
    expect(screen.getByText('Siti Aminah')).toBeTruthy();
    expect(screen.getAllByText('CRITICAL').length).toBeGreaterThan(0);
    expect(screen.getAllByText('HIGH').length).toBeGreaterThan(0);
    expect(screen.getByText('85')).toBeTruthy();
    expect(screen.getByText('72')).toBeTruthy();
  });

  it('meringkas berapa karyawan berisiko tinggi', async () => {
    render(<FlightRiskHeatmap />);
    await waitFor(() => expect(screen.getByText(/1 karyawan/i)).toBeTruthy());
  });

  it('menampilkan faktor penyebab, bukan hanya skor', async () => {
    render(<FlightRiskHeatmap />);
    await waitFor(() => expect(screen.getByText(/Ketidakhadiran 30 hari/)).toBeTruthy());
    expect(screen.getByText(/Beban lembur 30 hari/)).toBeTruthy();
  });

  it('menawarkan hitung ulang saat belum ada snapshot', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => empty));
    render(<FlightRiskHeatmap />);

    await waitFor(() => expect(screen.getByText(/Belum ada snapshot/i)).toBeTruthy());
    expect(screen.getByRole('button', { name: /Hitung ulang/i })).toBeTruthy();
  });

  it('tombol hitung ulang memanggil endpoint recompute lalu memuat ulang', async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method ?? 'GET' });
      if (String(url).includes('/recompute')) {
        return { ok: true, status: 200, json: async () => ({ status: 'success', data: { processed: 2, skipped: 0 } }) };
      }
      return withRisks;
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<FlightRiskHeatmap />);
    await waitFor(() => expect(screen.getByText('Budi Pratama')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /Hitung ulang/i }));

    await waitFor(() => {
      expect(calls.some((c) => c.url.includes('/recompute') && c.method === 'POST')).toBe(true);
    });
    expect(calls.filter((c) => c.url.includes('/analytics/flight-risk')).length).toBeGreaterThan(1);
  });

  it('menampilkan pesan galat dan tombol coba lagi', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 500, json: async () => ({ detail: 'Mesin analitik sedang sibuk.' }),
    })));
    render(<FlightRiskHeatmap />);
    await waitFor(() => expect(screen.getByText(/Mesin analitik sedang sibuk/)).toBeTruthy());
    expect(screen.getByRole('button', { name: /Coba lagi/i })).toBeTruthy();
  });
});
