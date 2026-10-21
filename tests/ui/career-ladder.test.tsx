// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import CareerLadderPanel from '@/components/employee/CareerLadderPanel';

const withLadder = {
  ok: true,
  json: async () => ({
    data: {
      steps: [
        { stepId: 's1', stepName: 'Masa kerja 1 tahun', requirementType: 'TENURE', threshold: 12, actual: 14, met: true, targetPositionId: 'p2' },
        { stepId: 's2', stepName: 'Sertifikasi wajib', requirementType: 'CERTIFICATION', threshold: 1, actual: 0, met: false, targetPositionId: 'p2' },
      ],
      readiness: { targetPositionId: 'p2', percent: 50, met: 1, total: 2 },
    },
  }),
};

const withoutLadder = {
  ok: true,
  json: async () => ({
    data: { steps: [], readiness: { targetPositionId: null, percent: 0, met: 0, total: 0 } },
  }),
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => withLadder));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('CareerLadderPanel', () => {
  it('menampilkan readiness dan status tiap tahapan', async () => {
    render(<CareerLadderPanel />);
    await waitFor(() => expect(screen.getByText(/50%/)).toBeTruthy());
    expect(screen.getByText('Masa kerja 1 tahun')).toBeTruthy();
    expect(screen.getByText(/Belum terpenuhi/)).toBeTruthy();
  });

  it('menyatakan belum ada tahapan tanpa membagi nol', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => withoutLadder));
    render(<CareerLadderPanel />);
    await waitFor(() => expect(screen.getByText(/Belum ada tahapan karir/)).toBeTruthy());
  });
});
