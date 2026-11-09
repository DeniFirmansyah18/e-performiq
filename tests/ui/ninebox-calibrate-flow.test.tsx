// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/dashboard/ninebox-matrix',
}));

import NineBoxMatrixPage from '@/app/dashboard/ninebox-matrix/page';

function stubFetch(gpaStatus: number) {
  global.fetch = vi.fn(async (input: any) => {
    const url = String(input);
    if (url.includes('/calculate-gpa')) {
      if (gpaStatus >= 400) {
        return {
          ok: false,
          status: gpaStatus,
          json: async () => ({
            status: 'error',
            code: 'FORBIDDEN',
            detail:
              "Peran 'PEOPLE_MANAGER' tidak memiliki otorisasi 'appraisal:calibrate' untuk menyimpan hasil penilaian.",
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'success',
          data: {
            appraisal_id: '40000000-0000-4000-8000-000000000009',
            is_calibrated: true,
            composite_gpa: 3.6,
            nine_box_placement: { quadrant: 'HIGH_IMPACT' },
          },
        }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ status: 'success', data: { total: 3, byQuadrant: {} } }),
    };
  }) as any;
}

async function submitCalibration() {
  render(<NineBoxMatrixPage />);
  // Dua pemicu membuka modal yang sama (header & kartu fitur); pakai yang pertama.
  fireEvent.click(screen.getAllByRole('button', { name: /Kalibrasi/i })[0]);
  fireEvent.click(await screen.findByRole('button', { name: /Sahkan Kalibrasi/i }));
}

describe('alur kalibrasi 9-Box', () => {
  beforeEach(() => {
    stubFetch(200);
  });

  afterEach(() => {
    cleanup();
  });

  it('menampilkan pesan galat dan TIDAK mengaku berhasil saat server menolak (403)', async () => {
    stubFetch(403);
    await submitCalibration();

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert').map((a) => a.textContent ?? '');
      expect(alerts.some((t) => /tidak memiliki otorisasi/i.test(t))).toBe(true);
    });
    expect(screen.queryByText(/berhasil/i)).toBeNull();
  });

  it('menampilkan galat DI DALAM modal agar terlihat, bukan tersembunyi di balik overlay', async () => {
    stubFetch(403);
    await submitCalibration();

    // Modal tetap terbuka dan memuat alert-nya sendiri.
    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(1);
    });
    expect(screen.getByRole('button', { name: /Sahkan Kalibrasi/i })).toBeTruthy();
  });

  it('menampilkan pesan sukses yang menyebut nilai sudah terkunci saat server menerima', async () => {
    await submitCalibration();

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/terkunci/i);
    });
  });
});
