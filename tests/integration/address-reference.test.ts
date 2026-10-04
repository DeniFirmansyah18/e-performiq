import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  isAddressConfigured, listProvinces, listKabupaten, searchAddress, lookupKodepos, resolveFullAddress,
} from '@/lib/services/addressReferenceService';

/**
 * Wilayah Alamat API (provinsi → desa + kode pos). `fetch` di-stub agar
 * deterministik tanpa jaringan.
 */
describe('Wilayah Alamat API (addressReferenceService)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.WILAYAH_API_URL;
  });

  const jsonResponse = (body: any, okRes = true) => ({ ok: okRes, status: okRes ? 200 : 503, json: async () => body }) as any;

  it('nonaktif bila WILAYAH_API_URL kosong (tanpa error)', async () => {
    delete process.env.WILAYAH_API_URL;
    expect(isAddressConfigured()).toBe(false);
    expect(await listProvinces()).toEqual([]);
    expect(await searchAddress('tebet')).toEqual([]);
    expect(await resolveFullAddress('1101012001')).toBeNull();
  });

  it('listProvinces memetakan data, + trimming trailing slash di base URL', async () => {
    process.env.WILAYAH_API_URL = 'http://127.0.0.1:8001/';
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(String(url));
      return jsonResponse({ ok: true, data: [{ kode: '11', nama: 'Aceh' }, { kode: '12', nama: 'Sumatera Utara' }] });
    }));
    const items = await listProvinces();
    expect(items.length).toBe(2);
    expect(items[0]).toEqual({ kode: '11', nama: 'Aceh', level: undefined });
    expect(calls[0].startsWith('http://127.0.0.1:8001/api/wilayah/provinsi')).toBe(true);
  });

  it('listKabupaten membersihkan kode (hanya digit) & memanggil endpoint', async () => {
    process.env.WILAYAH_API_URL = 'http://127.0.0.1:8001';
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(String(url));
      return jsonResponse({ ok: true, data: [{ kode: '1101', nama: 'Aceh Selatan' }] });
    }));
    const items = await listKabupaten('11 -');
    expect(items.length).toBe(1);
    expect(calls[0]).toContain('provinsi=11');
  });

  it('searchAddress memetakan hasil + alamat lengkap', async () => {
    process.env.WILAYAH_API_URL = 'http://127.0.0.1:8001';
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/api/alamat/search')) {
        return jsonResponse({ ok: true, data: [{
          kode: '3175010001', nama: 'Tebet Barat', level: 'desa', tipe: 'Kelurahan',
          kodepos: '12810', alamat_lengkap: 'Kelurahan Tebet Barat, Kecamatan Tebet, Kota Jakarta Selatan, DKI Jakarta',
        }] });
      }
      return jsonResponse({}, false);
    }));
    const res = await searchAddress('tebet');
    expect(res.length).toBe(1);
    expect(res[0].kode).toBe('3175010001');
    expect(res[0].kodepos).toBe('12810');
    expect(res[0].alamat_lengkap).toContain('Tebet Barat');
  });

  it('searchAddress query < 2 huruf berhenti sebelum fetch', async () => {
    process.env.WILAYAH_API_URL = 'http://127.0.0.1:8001';
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    expect(await searchAddress('a')).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('lookupKodepos mencari desa dari kode pos', async () => {
    process.env.WILAYAH_API_URL = 'http://127.0.0.1:8001';
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(String(url));
      return jsonResponse({ ok: true, data: [{ kode: '3573010001', nama: 'Klojen', level: 'desa', kodepos: '65161' }] });
    }));
    const res = await lookupKodepos('65161');
    expect(res.length).toBe(1);
    expect(res[0].kodepos).toBe('65161');
    expect(calls[0]).toContain('/api/kodepos/65161');
  });

  it('resolveFullAddress menambahkan kode pos untuk level desa bila belum ada', async () => {
    process.env.WILAYAH_API_URL = 'http://127.0.0.1:8001';
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      ok: true,
      data: { kode: { level: 'desa', kodepos: '12810' }, alamat_lengkap: 'Kelurahan Tebet Barat, Kecamatan Tebet, Kota Jakarta Selatan, DKI Jakarta' },
    })));
    const full = await resolveFullAddress('3175010001');
    expect(full).toContain('Tebet Barat');
    expect(full).toContain('12810');
  });

  it('tahan terhadap error jaringan (kembalikan [] / null)', async () => {
    process.env.WILAYAH_API_URL = 'http://127.0.0.1:8001';
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down'); }));
    expect(await listProvinces()).toEqual([]);
    expect(await searchAddress('tebet')).toEqual([]);
    expect(await resolveFullAddress('11')).toBeNull();
  });
});
