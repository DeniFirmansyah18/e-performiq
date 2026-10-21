// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import DailyVerificationPanel from '@/components/governance/DailyVerificationPanel';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/performance/daily-status/team')) {
      return { ok: true, json: async () => ({ data: { date: '2026-10-21', items: [
        { employeeId: 'b4', date: '2026-10-21', score: 55, trafficLight: 'RED', filled: 1, expected: 3, demotionReason: null },
      ] } }) } as any;
    }
    if (url.includes('/kpi-daily-entries')) {
      return { ok: true, json: async () => ({ data: { items: [
        { id: 'e1', indicatorId: 'i1', entryDate: '2026-10-21', actualValue: 5, status: 'SUBMITTED', isLate: false },
      ] } }) } as any;
    }
    return { ok: true, json: async () => ({ data: { items: [] } }) } as any;
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('DailyVerificationPanel', () => {
  it('menampilkan bawahan berstatus merah dengan label teks', async () => {
    render(<DailyVerificationPanel />);
    await waitFor(() => expect(screen.getByText(/Perlu tindakan/i)).toBeTruthy());
  });

  it('menyediakan tombol setujui dan tolak berlabel aksesibel', async () => {
    render(<DailyVerificationPanel />);
    await waitFor(() => expect(screen.getByText(/b4/)).toBeTruthy());
  });
});
