// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import ReimbursementDecisionPanel from '@/components/governance/ReimbursementDecisionPanel';

vi.mock('@/lib/context/AuthContext', () => ({
  useAuth: () => ({ activeRole: 'HR_MANAGER' }),
}));

const okJson = (data: unknown) => ({ ok: true, json: async () => ({ status: 'success', data }) });

const klaim = [
  {
    id: 'k1',
    employeeName: 'Budi Pratama',
    employeeCode: 'EMP-2022-0042',
    claimCategory: 'MEDICAL',
    amount: 500000,
    receiptUrl: 'https://contoh.id/struk.jpg',
    claimDate: '2026-11-01',
    status: 'SUBMITTED',
    decisionNote: null,
  },
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Panel Reimbursement (keputusan HR)', () => {
  it('menampilkan klaim menunggu beserta tombol Setujui & Tolak', async () => {
    const fetchMock = vi.fn(async () => okJson({ items: klaim }));
    vi.stubGlobal('fetch', fetchMock);

    render(<ReimbursementDecisionPanel />);

    await waitFor(() => expect(screen.getByText('Budi Pratama')).toBeTruthy());
    expect(screen.getByText('Setujui penuh')).toBeTruthy();
    expect(screen.getByText('Tolak')).toBeTruthy();
    // Hanya GET saat memuat; belum ada keputusan yang dikirim.
    expect(fetchMock.mock.calls.length).toBe(1);
    expect(String((fetchMock.mock.calls[0] as any)[0])).toContain(
      '/api/v1/finance/expense-claims?status=SUBMITTED'
    );
  });

  it('menolak tanpa alasan: tampil pesan galat, tidak memanggil PATCH', async () => {
    const fetchMock = vi.fn(async (url: any, init?: any) => {
      if (init?.method === 'PATCH') throw new Error('seharusnya tidak dipanggil');
      return okJson({ items: klaim });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ReimbursementDecisionPanel />);
    await waitFor(() => expect(screen.getByText('Budi Pratama')).toBeTruthy());

    fireEvent.click(screen.getByText('Tolak'));

    await waitFor(() =>
      expect(screen.getByText(/Alasan penolakan wajib diisi/)).toBeTruthy()
    );
    const patchCalls = fetchMock.mock.calls.filter(
      ([u, i]: any) => i?.method === 'PATCH'
    );
    expect(patchCalls.length).toBe(0);
  });

  it('klik Setujui penuh mengirim PATCH APPROVED tanpa nominal', async () => {
    const fetchMock = vi.fn(async (url: any, init?: any) => {
      if (init?.method === 'PATCH') {
        return okJson({ id: 'k1', status: 'APPROVED', approvedAmount: 500000 });
      }
      return okJson({ items: klaim });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ReimbursementDecisionPanel />);
    await waitFor(() => expect(screen.getByText('Budi Pratama')).toBeTruthy());

    fireEvent.click(screen.getByText('Setujui penuh'));

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(([, i]: any) => i?.method === 'PATCH');
      expect(patch).toBeTruthy();
    });

    const [, init]: any = fetchMock.mock.calls.find(([, i]: any) => i?.method === 'PATCH')!;
    expect(String((init as any).body)).toBeDefined();
    const body = JSON.parse(String((init as any).body));
    // Kebijakan "penuh saja": klien TIDAK mengirim nominal.
    expect(body.keputusan).toBe('APPROVED');
    expect(body.disetujui).toBeUndefined();
  });
});
