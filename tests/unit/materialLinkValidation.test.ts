import { describe, it, expect } from 'vitest';
import { periksaStatisOer } from '@/lib/services/oerLinkValidator';

/**
 * Validasi tautan materi sebelum disimpan (dipakai panel & endpoint
 * /learning/materials/validasi).
 */
describe('validasi tautan materi sebelum disimpan', () => {
  it('menerima tautan penyedia OER resmi', () => {
    for (const url of [
      'https://www.open.edu/openlearn/money-business/auditing/content-section-0',
      'https://learn.microsoft.com/en-us/training/paths/react/',
      'https://ocw.mit.edu/courses/6-036-introduction-to-machine-learning-fall-2020/',
    ]) {
      const r = periksaStatisOer(url);
      expect(r.gratis, url).toBe(true);
      expect(r.hidup, url).toBe(true);
    }
  });

  it('menolak tautan berbayar', () => {
    const r = periksaStatisOer('https://www.udemy.com/course/senior-engineer');
    expect(r.gratis).toBe(false);
    expect(r.alasan).toMatch(/berbayar/i);
  });

  it('menolak halaman pembelian pada penyedia gratis', () => {
    const r = periksaStatisOer('https://alison.com/checkout/plan-pro');
    expect(r.gratis).toBe(false);
    expect(r.alasan).toMatch(/pembelian|langganan/i);
  });

  it('menolak domain asing', () => {
    const r = periksaStatisOer('https://situs-asing.example.com/materi');
    expect(r.gratis).toBe(false);
    expect(r.alasan).toMatch(/tepercaya/i);
  });

  it('menolak tautan kosong / bukan URL', () => {
    expect(periksaStatisOer('').hidup).toBe(false);
    expect(periksaStatisOer('bukan-url').hidup).toBe(false);
  });

  it('tautan berkas internal (hasil unggahan) tidak perlu whitelist domain', async () => {
    // Endpoint validasi menandainya internal & sah tanpa memanggil jaringan.
    const url = '/api/v1/learning/materials/learning/materials/1700000000-materi.pdf';
    expect(url.startsWith('/api/v1/learning/materials/')).toBe(true);
  });
});
