// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';import LetterManagerPanel from '@/components/governance/LetterManagerPanel';
import PolicyManagerPanel from '@/components/governance/PolicyManagerPanel';

const letters = {
  ok: true,
  json: async () => ({ data: { total: 2, items: [
    { id: 'l1', agendaNumber: 'AG-001', direction: 'INCOMING', classification: 'TERBATAS',
      subject: 'Surat terbatas direksi', sender: 'Kementerian BUMN', letterDate: '2026-10-20',
      status: 'OPEN', openDispositions: 0, createdByName: 'hr@eperformiq.co.id', dispositions: [] },
    { id: 'l2', agendaNumber: 'AG-002', direction: 'INCOMING', classification: 'BIASA',
      subject: 'Undangan umum', sender: 'Vendor', letterDate: '2026-10-21',
      status: 'IN_PROGRESS', openDispositions: 1, createdByName: 'hr@eperformiq.co.id',
      dispositions: [{ id: 'd1', instruction: 'Siapkan bahan', status: 'BELUM_DIBACA',
        priority: 'HIGH', dueDate: '2026-10-25', toUserId: 'u2' }] },
  ] } }),
};

const policies = {
  ok: true,
  json: async () => ({ data: { total: 2, items: [
    { id: 'p1', documentCode: 'SOP-HR-001', title: 'SOP Cuti', policyType: 'SOP', version: '1.0',
      effectiveDate: '2026-01-01', fileUrl: 'https://files.example.com/v1.pdf', status: 'OBSOLETE',
      acknowledgedCount: 5, supersedesId: null },
    { id: 'p2', documentCode: 'SOP-HR-001', title: 'SOP Cuti', policyType: 'SOP', version: '2.0',
      effectiveDate: '2026-10-01', fileUrl: 'https://files.example.com/v2.pdf', status: 'AKTIF',
      acknowledgedCount: 2, supersedesId: 'p1' },
  ] } }),
};

const users = {
  ok: true,
  json: async () => ({ data: { items: [
    { id: 'u2', email: 'danu.tech@eperformiq.co.id', role: 'PEOPLE_MANAGER', fullName: 'Danu' },
  ] } }),
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/hr/letters')) return letters as any;
    if (url.includes('/hr/policies')) return policies as any;
    if (url.includes('/hr/users')) return users as any;
    return { ok: true, json: async () => ({ data: { items: [] } }) } as any;
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('LetterManagerPanel', () => {
  it('menampilkan register surat termasuk klasifikasi TERBATAS', async () => {
    render(<LetterManagerPanel />);
    await waitFor(() => expect(screen.getByText('AG-001')).toBeTruthy());
    expect(screen.getByText(/Surat terbatas direksi/)).toBeTruthy();
    // Pencocokan persis: badge klasifikasi, bukan catatan kaki yang juga memuat kata ini.
    expect(screen.getByText('TERBATAS')).toBeTruthy();
  });

  it('menampilkan jumlah disposisi terbuka', async () => {
    render(<LetterManagerPanel />);
    await waitFor(() => expect(screen.getByText('AG-002')).toBeTruthy());
    expect(screen.getByText(/1 disposisi terbuka/)).toBeTruthy();
  });

  it('menyediakan form pendaftaran surat dengan field wajib', async () => {
    render(<LetterManagerPanel />);
    expect(screen.getByLabelText(/Nomor agenda/i)).toBeTruthy();
    expect(screen.getByLabelText(/^Perihal/i)).toBeTruthy();
    expect(screen.getByLabelText(/Klasifikasi/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Daftarkan surat/i })).toBeTruthy();
  });

  it('membuka form disposisi saat tombol disposisi diklik', async () => {
    render(<LetterManagerPanel />);
    await waitFor(() => expect(screen.getByText('AG-001')).toBeTruthy());
    fireEvent.click(screen.getAllByRole('button', { name: /Beri disposisi/i })[0]);
    await waitFor(() => expect(screen.getByLabelText(/Penerima disposisi/i)).toBeTruthy());
  });
});

describe('PolicyManagerPanel', () => {
  it('menampilkan semua versi beserta status dan jumlah acknowledgment', async () => {
    render(<PolicyManagerPanel />);
    await waitFor(() => expect(screen.getByText('SOP Cuti')).toBeTruthy());
    expect(screen.getAllByText(/SOP Cuti/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/v1\.0/)).toBeTruthy();
    expect(screen.getByText(/v2\.0/)).toBeTruthy();
    // Pencocokan persis: badge status, bukan deskripsi panel yang juga memuat kata ini.
    expect(screen.getByText('OBSOLETE')).toBeTruthy();
    expect(screen.getByText(/5 pengakuan/)).toBeTruthy();
  });

  it('menyediakan form publikasi versi baru', () => {
    render(<PolicyManagerPanel />);
    expect(screen.getByLabelText(/Kode dokumen/i)).toBeTruthy();
    expect(screen.getByLabelText(/^Versi/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Terbitkan versi/i })).toBeTruthy();
  });

  it('menyediakan kontrol unggah PDF, bukan hanya URL', () => {
    render(<PolicyManagerPanel />);
    const input = screen.getByLabelText(/Berkas PDF/i) as HTMLInputElement;
    expect(input.type).toBe('file');
    expect(input.accept).toContain('application/pdf');
  });

  it('mengunggah PDF lalu menampilkan berkas siap terbit', async () => {
    const fetchMock = vi.fn(async (url: string, init?: any) => {
      if (url.includes('/policies/upload')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              storageKey: 'policies/abc-SOP-Cuti.pdf',
              fileName: 'SOP Cuti.pdf',
              size: 1234,
              checksumSha256: 'a'.repeat(64),
              pageCount: 2,
              scanStatus: 'SKIPPED',
              scanEngine: 'none',
              driver: 'local',
            },
          }),
        } as any;
      }
      if (url.includes('/hr/policies')) return policies as any;
      return { ok: true, json: async () => ({ data: { items: [] } }) } as any;
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<PolicyManagerPanel />);
    const input = screen.getByLabelText(/Berkas PDF/i) as HTMLInputElement;
    const file = new File([new Uint8Array([37, 80, 68, 70])], 'SOP Cuti.pdf', { type: 'application/pdf' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText(/Berkas siap terbit/i)).toBeTruthy());
    expect(screen.getByText(/SOP Cuti\.pdf/)).toBeTruthy();
    expect(screen.getByText(/2 halaman/)).toBeTruthy();

    const uploadCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/policies/upload'));
    expect(uploadCall).toBeTruthy();
    expect(uploadCall![1]?.method).toBe('POST');
  });
});
