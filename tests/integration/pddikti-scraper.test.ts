import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { searchInstitutions, getPtDetail } from '@/lib/services/educationReferenceService';

/**
 * Integrasi scraper PDDikti (pddikti-pt-api) dengan sumber resmi + fallback lokal.
 * `fetch` di-stub agar hasil deterministik tanpa jaringan.
 */
describe('PDDikti scraper API (pddikti-pt-api)', () => {
  let client: PGlite;
  let db: any;
  const realFetch = global.fetch;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
  });
  afterAll(async () => { await client.close(); });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PDDIKTI_API_URL;
  });

  const jsonResponse = (body: any, okRes = true) => ({
    ok: okRes, status: okRes ? 200 : 503,
    json: async () => body,
  }) as any;

  it('memakai scraper sebagai sumber utama & membawa externalId (id base64url)', async () => {
    process.env.PDDIKTI_API_URL = 'http://127.0.0.1:8000';
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/api/pt/search')) {
        return jsonResponse({
          ok: true, source: 'demo',
          data: [{ id: 'Wg==', kode: '001001', nama: 'Universitas Indonesia', nama_singkat: 'UI' }],
          meta: { keyword: 'ui', count: 1 },
        });
      }
      return jsonResponse({}, false);
    }));

    const res = await searchInstitutions(db, 'universitas indonesia');
    const ui = res.find((r) => /^universitas indonesia$/i.test(r.name));
    expect(ui).toBeTruthy();
    expect(ui!.code).toBe('001001');
    expect(ui!.externalId).toBe('Wg==');
  });

  it('fallback ke sumber resmi bila scraper tidak dikonfigurasi', async () => {
    delete process.env.PDDIKTI_API_URL;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      // scraper tidak dipanggil; sumber resmi/gateway mengembalikan bentuk PDDikti
      if (String(url).includes('api-pddikti')) {
        return jsonResponse({ data: [{ nama: 'Universitas Gadjah Mada', kode: '003001' }] });
      }
      return jsonResponse({}, false);
    }));

    const res = await searchInstitutions(db, 'universitas gadjah');
    expect(res.some((r) => /gadjah mada/i.test(r.name))).toBe(true);
  });

  it('fallback ke seed lokal bila semua API mati', async () => {
    process.env.PDDIKTI_API_URL = 'http://127.0.0.1:8000';
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));

    const res = await searchInstitutions(db, 'universitas indonesia');
    expect(res.some((r) => /universitas indonesia/i.test(r.name))).toBe(true);
  });

  it('getPtDetail mengembalikan detail + prodi dari scraper', async () => {
    process.env.PDDIKTI_API_URL = 'http://127.0.0.1:8000';
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('with_prodi=1')) {
        return jsonResponse({
          ok: true,
          data: { nama_pt: 'Universitas Indonesia', status_pt: 'Aktif', akreditasi_pt: 'Unggul', provinsi_pt: 'DKI Jakarta' },
          prodi: [{ nama_prodi: 'Teknik Informatika', jenjang_prodi: 'S1' }],
        });
      }
      return jsonResponse({}, false);
    }));

    const out = await getPtDetail('Wg==', { withProdi: true });
    expect(out.source).toBe('SCRAPER');
    expect(out.detail?.nama_pt).toBe('Universitas Indonesia');
    expect(out.detail?.akreditasi_pt).toBe('Unggul');
    expect(out.prodi.length).toBe(1);
    expect(out.prodi[0].nama_prodi).toBe('Teknik Informatika');
  });

  it('getPtDetail mengambil prodi via endpoint terpisah bila belum disertakan', async () => {
    process.env.PDDIKTI_API_URL = 'http://127.0.0.1:8000';
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(String(url));
      if (String(url).endsWith('/prodi')) {
        return jsonResponse({ ok: true, data: [{ nama_prodi: 'Manajemen' }] });
      }
      if (String(url).includes('with_prodi=1')) {
        return jsonResponse({ ok: true, data: { nama_pt: 'X' } }); // tanpa prodi
      }
      return jsonResponse({}, false);
    }));

    const out = await getPtDetail('Wg==', { withProdi: true });
    expect(out.detail?.nama_pt).toBe('X');
    expect(out.prodi.some((p) => p.nama_prodi === 'Manajemen')).toBe(true);
    expect(calls.some((c) => c.endsWith('/prodi'))).toBe(true);
  });

  it('getPtDetail → NONE bila scraper tak dikonfigurasi', async () => {
    delete process.env.PDDIKTI_API_URL;
    const out = await getPtDetail('Wg==', { withProdi: true });
    expect(out.source).toBe('NONE');
    expect(out.detail).toBeNull();
    expect(out.prodi).toEqual([]);
  });

  it('kembalikan real fetch (guard)', () => {
    vi.stubGlobal('fetch', realFetch);
    expect(typeof global.fetch).toBe('function');
  });
});
