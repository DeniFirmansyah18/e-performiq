// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import DailyStatusCard from '@/components/employee/DailyStatusCard';
import DailyKpiChecklist from '@/components/employee/DailyKpiChecklist';

const status = {
  employeeId: 'b1', date: '2026-10-21', score: 64.5, trafficLight: 'RED',
  filled: 2, expected: 3, demotionReason: null, weakest: 'i1',
  thresholds: { green: 90, yellow: 70, cap: 1.2, absenceDemotes: true },
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/me/daily-status')) return { ok: true, json: async () => ({ data: status }) } as any;
    if (url.includes('/me/kpi-indicators')) {
      return { ok: true, json: async () => ({ data: { items: [
        { id: 'i1', kpiTitle: 'Layanan', indicatorName: 'Tiket selesai', unit: 'tiket',
          target: 10, direction: 'HIGHER_BETTER', frequency: 'DAILY', aggregation: 'SUM', weight: 100 },
      ] } }) } as any;
    }
    return { ok: true, json: async () => ({ data: { items: [] } }) } as any;
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Daily Cockpit', () => {
  it('menampilkan warna DAN label teks, bukan warna saja', async () => {
    render(<DailyStatusCard />);
    // Ruling R3: fixture RED → label "Perlu tindakan", bukan "Perlu perhatian" (itu YELLOW).
    await waitFor(() => expect(screen.getByText(/Perlu tindakan/i)).toBeTruthy());
    expect(screen.getByText(/64.5/)).toBeTruthy();
  });

  it('checklist menampilkan indikator yang belum diisi', async () => {
    render(<DailyKpiChecklist />);
    await waitFor(() => expect(screen.getByText('Tiket selesai')).toBeTruthy());
    // Ruling R4: status tanpa entri wajib punya label teks, bukan hanya ikon.
    expect(screen.getByText(/Belum diisi/i)).toBeTruthy();
  });
});
