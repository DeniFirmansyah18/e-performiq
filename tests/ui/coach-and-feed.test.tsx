// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import ActivityFeedPanel from '@/components/employee/ActivityFeedPanel';
import PerformanceCoachPanel from '@/components/employee/PerformanceCoachPanel';

const feed = {
  ok: true,
  json: async () => ({
    data: {
      items: [
        { id: 'a1', eventType: 'KPI_DAILY', summary: 'Mengirim 2 indikator', visibility: 'INTERNAL',
          occurredAt: '2026-10-21T08:00:00Z' },
      ],
    },
  }),
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => feed));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('feed & coach UI', () => {
  it('feed menampilkan ringkasan kejadian', async () => {
    render(<ActivityFeedPanel />);
    await waitFor(() => expect(screen.getByText(/Mengirim 2 indikator/)).toBeTruthy());
  });

  it('coach menyediakan input pertanyaan', () => {
    render(<PerformanceCoachPanel />);
    expect(screen.getByLabelText(/Pertanyaan tentang performa/i)).toBeTruthy();
  });
});
