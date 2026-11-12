// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import RecruitmentPanel from '@/components/governance/RecruitmentPanel';

const kandidat = [
  {
    id: 'a1', applicationNo: 'APP-1', status: 'OFFER_DECLINED', appliedAt: '2026-01-01',
    fullName: 'Budi Uji', email: 'b@x.id', postingTitle: 'Engineer', offerStatus: 'DECLINED',
  },
  {
    id: 'a2', applicationNo: 'APP-2', status: 'OFFERED', appliedAt: '2026-01-01',
    fullName: 'Ani Uji', email: 'a@x.id', postingTitle: 'Engineer', offerStatus: 'SENT',
  },
];

const stub = () => {
  global.fetch = vi.fn(async (url: any) => {
    const u = String(url);
    if (u.includes('/recruitment/candidates')) {
      return { ok: true, status: 200, json: async () => ({ status: 'success', data: { candidates: kandidat } }) } as any;
    }
    return { ok: true, status: 200, json: async () => ({ status: 'success', data: {} }) } as any;
  }) as any;
};

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('RecruitmentPanel — batas tanggung jawab & kolom keterangan', () => {
  it('TIDAK memuat kartu "Kelola Lowongan" di dalamnya', async () => {
    stub();
    render(<RecruitmentPanel />);
    await waitFor(() => expect(screen.getByText('Budi Uji')).toBeTruthy());

    const teks = (document.body.textContent || '').replace(/\s+/g, ' ');
    // Kelola Lowongan milik golongan "Perencanaan Kebutuhan", bukan panel ini.
    expect(teks).not.toMatch(/Kelola Lowongan/i);
  });

  it('menampilkan keterangan penawaran sebagai KOLOM tersendiri', async () => {
    stub();
    render(<RecruitmentPanel />);
    await waitFor(() => expect(screen.getByText('Budi Uji')).toBeTruthy());

    const header = Array.from(document.querySelectorAll('table thead th')).map((t) => (t.textContent || '').trim());
    expect(header).toContain('Status');
    expect(header).toContain('Keterangan');
    expect(header).toContain('Aksi');

    // Keterangan berada di kolom sendiri, tepat sebelum Aksi.
    expect(header.indexOf('Keterangan')).toBe(header.indexOf('Status') + 1);
    expect(header.indexOf('Aksi')).toBe(header.indexOf('Keterangan') + 1);
  });

  it('keterangan penolakan muncul di kolom Keterangan', async () => {
    stub();
    render(<RecruitmentPanel />);
    await waitFor(() => expect(screen.getByText('Budi Uji')).toBeTruthy());

    const barisBudi = Array.from(document.querySelectorAll('table tbody tr')).find((tr) =>
      (tr.textContent || '').includes('Budi Uji')
    )!;
    const sel = barisBudi.querySelectorAll('td');
    const isiKeterangan = (sel[sel.length - 2]?.textContent || '').trim();
    expect(isiKeterangan).toMatch(/Kandidat menolak penawaran/i);
  });
});
