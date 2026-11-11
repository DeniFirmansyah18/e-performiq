import { describe, it, expect } from 'vitest';
import { maskNumber, buildCard } from '@/lib/services/socialSecurityService';

/**
 * "Belum terdaftar" bukan "tidak ditemukan". Endpoint `/me/social-security`
 * harus menjawab 200 dengan penanda `registered: false`, bukan 404 — 404
 * memicu log error di konsol browser meski UI sudah menanganinya.
 */
describe('kartu BPJS untuk pegawai yang belum terdaftar', () => {
  it('buildCard(null) menghasilkan kartu kosong bertanda belum terdaftar', () => {
    const card = buildCard(null);
    expect(card).not.toBeNull();
    expect(card?.registered).toBe(false);
    expect(card?.bpjsTkNumber).toBeNull();
    expect(card?.bpjsKesNumber).toBeNull();
  });

  it('buildCard(row) menandai terdaftar dan menyamarkan nomor', () => {
    const card = buildCard({
      bpjsTkNumber: '2101234567890123',
      bpjsKesNumber: '0001234567890123',
      bpjsKesClass: 'Kelas 1',
      bpjsTkStatus: 'ACTIVE',
      bpjsKesStatus: 'ACTIVE',
      registeredAt: '2026-01-01',
    } as any);
    expect(card?.registered).toBe(true);
    expect(card?.bpjsTkNumber).toBe('••••••••••••0123');
    expect(maskNumber('2101234567890123')).toBe('••••••••••••0123');
  });
});
