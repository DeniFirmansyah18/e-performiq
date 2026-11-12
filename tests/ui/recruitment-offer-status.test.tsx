// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import RecruitmentPanel from '@/components/governance/RecruitmentPanel';

const kandidat = [
  { id: 'a1', applicationNo: 'APP-1', status: 'OFFERED', appliedAt: '2026-01-01', fullName: 'Budi Uji', email: 'b@x.id', postingTitle: 'Engineer', offerStatus: 'SENT' },
  { id: 'a2', applicationNo: 'APP-2', status: 'OFFER_DECLINED', appliedAt: '2026-01-01', fullName: 'Ani Uji', email: 'a@x.id', postingTitle: 'Engineer', offerStatus: 'DECLINED' },
];

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('RecruitmentPanel — keterangan status penawaran', () => {
  it('menampilkan "Menunggu respons" untuk penawaran yang belum dijawab', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ status: 'success', data: { candidates: kandidat } }),
    })) as any);

    render(<RecruitmentPanel />);
    await waitFor(() => expect(screen.getByText('Budi Uji')).toBeTruthy());
    expect(screen.getByText('Menunggu respons')).toBeTruthy();
  });

  it('menampilkan keterangan penolakan kandidat', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ status: 'success', data: { candidates: kandidat } }),
    })) as any);

    render(<RecruitmentPanel />);
    await waitFor(() => expect(screen.getByText('Ani Uji')).toBeTruthy());
    expect(screen.getByText(/Kandidat menolak penawaran/i)).toBeTruthy();
  });

  it('tidak lagi menyediakan tombol Penawaran atau Respons', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ status: 'success', data: { candidates: kandidat } }),
    })) as any);

    render(<RecruitmentPanel />);
    await waitFor(() => expect(screen.getByText('Budi Uji')).toBeTruthy());
    const semuaTombol = screen.getAllByRole('button').map((b) => (b.textContent || '').trim());
    expect(semuaTombol.some((t) => /^Penawaran$/i.test(t))).toBe(false);
    expect(semuaTombol.some((t) => /^Respons$/i.test(t))).toBe(false);
  });
});
