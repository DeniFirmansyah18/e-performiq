// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import OfferModal from '@/components/governance/OfferModal';

describe('OfferModal — terbitkan penawaran & respons kandidat', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('merender formulir gaji, tunjangan, batas respons dan menerbitkan penawaran', async () => {
    const calls: Array<{ method: string; body: unknown }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : null });
      const u = String(url);
      if (u.includes('/offer') && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            status: 'success',
            data: {
              applicationId: 'app1', status: 'SENT', baseSalary: 28500000,
              fixedAllowance: 2500000, letterAgendaNumber: 'OFFER-20261030-AB12',
              responseDeadline: '2026-11-06T00:00:00.000Z',
            },
          }),
        };
      }
      return { ok: true, json: async () => ({ status: 'success', data: {} }) };
    }));

    render(
      <OfferModal
        applicationId="app1"
        candidateName="Budi Pratama"
        postingTitle="Senior Software Engineer"
        onClose={() => {}}
        onDone={() => {}}
      />
    );

    await waitFor(() => expect(screen.getByText('Penawaran Kerja')).toBeTruthy());
    expect(screen.getByLabelText(/Gaji Pokok/)).toBeTruthy();
    expect(screen.getByLabelText(/Batas Respons \(hari\)/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Gaji Pokok/), { target: { value: '28500000' } });
    fireEvent.change(screen.getByLabelText(/Tunjangan Tetap/), { target: { value: '2500000' } });
    fireEvent.change(screen.getByLabelText(/Batas Respons \(hari\)/), { target: { value: '7' } });

    fireEvent.click(screen.getByRole('button', { name: /Terbitkan Penawaran/ }));

    await waitFor(() =>
          expect(calls.some((c) => c.method === 'POST' && (c.body as any)?.baseSalary === 28500000)).toBe(true)
        );
        expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({
          baseSalary: 28500000,
          fixedAllowance: 2500000,
          responseDays: 7,
        });

    // Nama & posisi kandidat tertera pada formulir.
    expect(screen.getByText(/Budi Pratama/)).toBeTruthy();
    expect(screen.getByText(/Senior Software Engineer/)).toBeTruthy();
  });

  it('menolak gaji negatif dan batas respons nol', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })));
    render(
      <OfferModal
        applicationId="app1" candidateName="Budi Pratama" postingTitle="Posisi"
        onClose={() => {}} onDone={() => {}}
      />
    );

    fireEvent.change(screen.getByLabelText(/Gaji Pokok/), { target: { value: '-5' } });
    fireEvent.click(screen.getByRole('button', { name: /Terbitkan Penawaran/ }));
    await waitFor(() => expect(screen.getByText(/gaji wajib/i)).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/Gaji Pokok/), { target: { value: '10000000' } });
    fireEvent.change(screen.getByLabelText(/Batas Respons \(hari\)/), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /Terbitkan Penawaran/ }));
    await waitFor(() => expect(screen.getByText(/1-60 hari/i)).toBeTruthy());
  });

  it('menawarkan Terima/Tolak saat status OFFERED dan mengirim PATCH', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        calls.push(String(init.body));
        return {
          ok: true,
          json: async () => ({
            status: 'success',
            data: { applicationId: 'app1', status: 'ACCEPTED' },
          }),
        };
      }
      return { ok: true, json: async () => ({ status: 'success', data: {} }) };
    }));

    const onDone = vi.fn();
    render(
      <OfferModal
        applicationId="app1" candidateName="Budi Pratama" postingTitle="Posisi"
        mode="respond" onClose={() => {}} onDone={onDone}
      />
    );

    await waitFor(() => expect(screen.getByRole('button', { name: /Menerima/ })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Menerima/ }));

    await waitFor(() => expect(calls.some((c) => c.includes('ACCEPTED'))).toBe(true));
    expect(onDone).toHaveBeenCalled();
  });
});