// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import LetterInboxModal from '@/components/employee/LetterInboxModal';
import PolicyLibraryModal from '@/components/employee/PolicyLibraryModal';
import ChatDrawer from '@/components/employee/ChatDrawer';

const letters = {
  ok: true,
  json: async () => ({ data: { items: [
    { id: 'l1', agendaNumber: 'AG-2026-0001', direction: 'INCOMING', classification: 'BIASA',
      subject: 'Undangan rapat koordinasi', sender: 'Kementerian BUMN',
      letterDate: '2026-10-20', status: 'IN_PROGRESS', dispositions: [
        { id: 'd1', instruction: 'Siapkan bahan', status: 'BELUM_DIBACA', dueDate: '2026-10-25' },
      ] },
  ] } }),
};

const policies = {
  ok: true,
  json: async () => ({ data: { items: [
    { id: 'p1', documentCode: 'SOP-HR-001', title: 'SOP Cuti', policyType: 'SOP',
      version: '2.0', effectiveDate: '2026-10-01', fileUrl: 'https://files.example.com/sop.pdf',
      status: 'AKTIF', acknowledgedAt: null },
  ] } }),
};

const conversations = {
  ok: true,
  json: async () => ({ data: { items: [
    { id: 'c1', conversationType: 'DIRECT', title: 'Dengan Atasan', lastMessageAt: null, unreadCount: 2 },
  ] } }),
};

const messages = {
  ok: true,
  json: async () => ({ data: { items: [
    { id: 'm1', conversationId: 'c1', senderId: 'u2', body: 'Tolong siapkan laporan',
      attachmentUrl: null, isRecalled: false, sentAt: '2026-10-21T08:00:00Z' },
  ] } }),
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/letters')) return letters as any;
    if (url.includes('/policies')) return policies as any;
    if (url.endsWith('/conversations')) return conversations as any;
    if (url.includes('/messages')) return messages as any;
    return { ok: true, json: async () => ({ data: { items: [] } }) } as any;
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('LetterInboxModal', () => {
  it('menampilkan surat dengan nomor agenda, status, dan disposisi', async () => {
    render(<LetterInboxModal open onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText(/AG-2026-0001/)).toBeTruthy());
    expect(screen.getByText(/Undangan rapat koordinasi/)).toBeTruthy();
    expect(screen.getByText(/Sedang diproses/)).toBeTruthy();
    expect(screen.getByText(/Siapkan bahan/)).toBeTruthy();
  });
});

describe('PolicyLibraryModal', () => {
  it('menampilkan dokumen aktif dan status belum diakui', async () => {
    render(<PolicyLibraryModal open onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('SOP Cuti')).toBeTruthy());
    expect(screen.getByText(/Belum diakui/)).toBeTruthy();
  });
});

describe('ChatDrawer', () => {
  it('menampilkan percakapan dan pesan', async () => {
    render(<ChatDrawer open onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Dengan Atasan/)).toBeTruthy());
    await waitFor(() => expect(screen.getByText(/Tolong siapkan laporan/)).toBeTruthy());
  });

  it('menyediakan input pesan', () => {
    render(<ChatDrawer open onClose={() => {}} />);
    expect(screen.getByLabelText(/Tulis pesan/i)).toBeTruthy();
  });
});
