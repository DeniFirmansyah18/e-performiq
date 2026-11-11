// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import NineBoxGrid from '@/components/charts/NineBoxGrid';

afterEach(() => cleanup());

describe('NineBoxGrid label', () => {
  it('memakai nama kotak Bahasa Indonesia, bukan istilah Inggris lama', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as any;
    render(<NineBoxGrid />);

    expect(await screen.findByText('Penggerak Inti')).toBeTruthy();
    // Istilah sehari-hari: kemampuan naik level vs hasil kerja.
    expect(screen.getByText('Siap Naik Level, Hasil Kerja Rendah')).toBeTruthy();
    expect(screen.queryByText(/Enigma/)).toBeNull();
    expect(screen.queryByText(/Core Player/)).toBeNull();
    expect(screen.queryByText(/Potensi Tinggi, Kinerja Rendah/)).toBeNull();
  });
});
