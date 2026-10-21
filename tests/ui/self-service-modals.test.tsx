// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import SocialSecurityCard from '@/components/employee/SocialSecurityCard';
import DisciplinaryModal from '@/components/employee/DisciplinaryModal';
import OvertimeModal from '@/components/employee/OvertimeModal';
import DocumentsCard from '@/components/employee/DocumentsCard';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/social-security')) {
      return { ok: true, json: async () => ({ data: {
        bpjsTkNumber: '••••••••••••0123', bpjsKesNumber: '•••••••••7890',
        bpjsKesClass: 'Kelas 1', bpjsTkStatus: 'ACTIVE', bpjsKesStatus: 'ACTIVE',
        registeredAt: '2024-01-05',
      } }) } as any;
    }
    if (url.includes('/disciplinary-actions')) {
      return { ok: true, json: async () => ({ data: { items: [
        { id: 'd1', actionType: 'SP1', reason: 'Terlambat berulang',
          effectiveDate: '2026-10-01', expiryDate: null, appealStatus: 'NONE',
          appealDeadline: '2026-10-06' },
      ] } }) } as any;
    }
    if (url.includes('/recognitions')) {
      return { ok: true, json: async () => ({ data: { items: [
        { id: 'r1', title: 'Karyawan Terbaik Oktober', awardedDate: '2026-10-20', certificateUrl: null },
      ] } }) } as any;
    }
    if (url.includes('/me/documents')) {
      return { ok: true, json: async () => ({ data: { items: [
        { id: 'doc1', documentType: 'KTP', fileUrl: 'https://files.example.com/ktp.pdf',
          verificationStatus: 'VERIFIED', expiryDate: null },
      ] } }) } as any;
    }
    if (url.includes('/overtime-requests')) {
      return { ok: true, json: async () => ({ data: { items: [
        { id: 'o1', workDate: '2026-10-25', plannedHours: 2, reason: 'laporan bulanan', status: 'SUBMITTED' },
      ] } }) } as any;
    }
    return { ok: true, json: async () => ({ data: { items: [] } }) } as any;
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('self-service UI', () => {
  it('kartu BPJS menampilkan nomor ter-masking dan kelas', async () => {
    render(<SocialSecurityCard />);
    await waitFor(() => expect(screen.getByText(/••••••••••••0123/)).toBeTruthy());
    expect(screen.getByText(/Kelas 1/)).toBeTruthy();
  });

  it('modal sanksi menampilkan alasan dan status keberatan', async () => {
    render(<DisciplinaryModal open onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Terlambat berulang/)).toBeTruthy());
    expect(screen.getByText(/Belum diajukan/)).toBeTruthy();
  });

  it('modal lembur menampilkan riwayat dan status', async () => {
    render(<OvertimeModal open onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Menunggu persetujuan/)).toBeTruthy());
  });

  it('kartu berkas menampilkan status verifikasi', async () => {
    render(<DocumentsCard />);
    await waitFor(() => expect(screen.getByText('KTP')).toBeTruthy());
    expect(screen.getByText(/Terverifikasi/)).toBeTruthy();
  });
});
