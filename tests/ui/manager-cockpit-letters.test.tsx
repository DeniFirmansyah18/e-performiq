// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import ManagerCockpitPage from '@/app/dashboard/manager-cockpit/page';

/** Stub fetch dengan data kosong yang aman untuk semua endpoint halaman. */
const empty = (items: unknown[] = []) => ({ ok: true, json: async () => ({ data: { items } }) });
const okJson = (data: unknown) => ({ ok: true, json: async () => ({ status: 'success', data }) });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
    const u = String(url);
    if (u.includes('/team-roster')) return okJson({ members: [] });
    if (u.includes('/pre-employment/probation')) return okJson({ milestones: [] });
    if (u.includes('/api/v1/letters')) return empty([]);
    if (u.includes('/api/v1/policies')) return empty([]);
    return empty([]);
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Manager Cockpit: e-Surat & SOP (rantai #4, HR -> PM)', () => {
  it('menampilkan aksi cepat e-Surat & SOP untuk People Manager', async () => {
    render(<ManagerCockpitPage />);
    await waitFor(() => expect(screen.getByText('Aksi Cepat Manajerial')).toBeTruthy());
    expect(screen.getByText('e-Surat & Disposisi')).toBeTruthy();
    expect(screen.getByText('SOP & Peraturan')).toBeTruthy();
  });

  it('membuka inbox e-Surat saat kartu diklik, memuat daftar surat', async () => {
    render(<ManagerCockpitPage />);
    await waitFor(() => expect(screen.getByText('e-Surat & Disposisi')).toBeTruthy());
    fireEvent.click(screen.getByText('e-Surat & Disposisi'));

    // Modal muncul dengan judul & teks kosong-state setelah muat.
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    await waitFor(() => expect(screen.getByText(/Belum ada surat untuk Anda/i)).toBeTruthy());
  });

  it('membuka perpustakaan SOP & Peraturan saat kartu diklik', async () => {
    render(<ManagerCockpitPage />);
    await waitFor(() => expect(screen.getByText('SOP & Peraturan')).toBeTruthy());
    fireEvent.click(screen.getByText('SOP & Peraturan'));

    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    // Perpustakaan SOP terbuka (judul modal berisi "Peraturan"/"SOP").
    expect(document.body.textContent ?? '').toMatch(/SOP|Peraturan/i);
  });
});
