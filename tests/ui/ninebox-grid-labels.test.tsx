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
    expect(screen.getByText('Potensi Tinggi, Kinerja Rendah')).toBeTruthy();
    expect(screen.queryByText(/Enigma/)).toBeNull();
    expect(screen.queryByText(/Core Player/)).toBeNull();
  });
});
