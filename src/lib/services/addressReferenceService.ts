/**
 * Address Reference Service (Wilayah Alamat API) — pencarian alamat resmi
 * Indonesia: Provinsi → Kabupaten/Kota → Kecamatan → Desa/Kelurahan + Kode Pos.
 *
 * Sumber: layanan sendiri `wilayah-alamat-api` (FastAPI) via env `WILAYAH_API_URL`.
 * Endpoint upstream:
 *   GET {base}/api/wilayah/provinsi
 *   GET {base}/api/wilayah/kabupaten?provinsi=11
 *   GET {base}/api/wilayah/kecamatan?kabupaten=1101
 *   GET {base}/api/wilayah/desa?kecamatan=110101
 *   GET {base}/api/alamat/search?q=tebet[&level=desa][&limit=20]
 *   GET {base}/api/alamat/lengkap?kode=1101012001
 *   GET {base}/api/kodepos/{kodepos}
 *
 * Prinsip: best-effort + timeout. Bila layanan tak dikonfigurasi/mati →
 * kembalikan array kosong / null (TIDAK melempar error), sehingga form tetap
 * dapat dipakai (kandidat bisa mengetik alamat manual).
 */

import { SEED_PROVINSI, SEED_KABUPATEN, SEED_KECAMATAN } from '@/lib/db/seed/address-seed';

export interface WilayahItem {
  kode: string;
  nama: string;
  level?: string;
}

export interface AddressResult {
  kode: string;
  nama: string;
  level: string;
  tipe?: string | null;
  kodepos?: string | null;
  alamat_lengkap?: string | null;
  source?: 'API' | 'LOCAL';
}

/** Base URL layanan wilayah (kosong → pakai seed lokal). */
export function wilayahBaseUrl(): string | null {
  const raw = (process.env.WILAYAH_API_URL ?? '').trim();
  return raw ? raw.replace(/\/+$/, '') : null;
}

/**
 * Selalu ada data lokal (provinsi + kabupaten/kota + kecamatan), sehingga
 * dropdown alamat tetap berfungsi walau layanan API tidak dikonfigurasi.
 */
export function isAddressConfigured(): boolean {
  return true;
}

/** True bila layanan API eksternal dikonfigurasi (untuk info UI). */
export function isAddressApiConfigured(): boolean {
  return !!wilayahBaseUrl();
}

async function fetchJson(url: string, timeoutMs = 6000): Promise<any | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function digits(s: string): string {
  return String(s ?? '').replace(/\D/g, '');
}

function pickArray(json: any): any[] {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.data)) return json.data;
  return [];
}

function mapItem(x: any): WilayahItem {
  return {
    kode: String(x.kode ?? x.id ?? ''),
    nama: String(x.nama ?? x.name ?? '').trim(),
    level: x.level ?? undefined,
  };
}

// ---------------------------------------------------------------- SEED LOKAL
// Selalu tersedia (offline). Level desa/kelurahan hanya via API.

/** Daftar provinsi. */
export async function listProvinces(): Promise<WilayahItem[]> {
  const base = wilayahBaseUrl();
  if (base) {
    const json = await fetchJson(`${base}/api/wilayah/provinsi`);
    const items = pickArray(json).map(mapItem).filter((x) => x.kode && x.nama);
    if (items.length > 0) return items;
  }
  // Fallback lokal
  return SEED_PROVINSI.map((p) => ({ kode: p.kode, nama: p.nama, level: 'provinsi' }));
}

/** Daftar kabupaten/kota dalam sebuah provinsi (kode 2 digit). */
export async function listKabupaten(provinsi: string): Promise<WilayahItem[]> {
  const kode = digits(provinsi);
  if (!kode) return [];
  const base = wilayahBaseUrl();
  if (base) {
    const json = await fetchJson(`${base}/api/wilayah/kabupaten?provinsi=${encodeURIComponent(kode)}`);
    const items = pickArray(json).map(mapItem).filter((x) => x.kode && x.nama);
    if (items.length > 0) return items;
  }
  return SEED_KABUPATEN
    .filter((k) => k.kode.startsWith(kode))
    .map((k) => ({ kode: k.kode, nama: k.tipe ? `${k.tipe} ${k.nama}` : k.nama, level: 'kabupaten' }));
}

/** Daftar kecamatan dalam sebuah kabupaten/kota (kode 4 digit). */
export async function listKecamatan(kabupaten: string): Promise<WilayahItem[]> {
  const kode = digits(kabupaten);
  if (!kode) return [];
  const base = wilayahBaseUrl();
  if (base) {
    const json = await fetchJson(`${base}/api/wilayah/kecamatan?kabupaten=${encodeURIComponent(kode)}`);
    const items = pickArray(json).map(mapItem).filter((x) => x.kode && x.nama);
    if (items.length > 0) return items;
  }
  return SEED_KECAMATAN
    .filter((k) => k.kode.startsWith(kode))
    .map((k) => ({ kode: k.kode, nama: k.nama, level: 'kecamatan' }));
}

/** Daftar desa/kelurahan dalam sebuah kecamatan (kode 6 digit) — hanya via API. */
export async function listDesa(kecamatan: string): Promise<WilayahItem[]> {
  const base = wilayahBaseUrl();
  const kode = digits(kecamatan);
  if (!base || !kode) return [];
  const json = await fetchJson(`${base}/api/wilayah/desa?kecamatan=${encodeURIComponent(kode)}`);
  return pickArray(json).map(mapItem).filter((x) => x.kode && x.nama);
}

/** Label lengkap lokal untuk sebuah kode wilayah (prov/kab/kec). */
function localLabel(kode: string): { nama: string; level: string; alamat_lengkap: string } | null {
  const k = digits(kode);
  if (k.length === 2) {
    const p = SEED_PROVINSI.find((x) => x.kode === k);
    return p ? { nama: p.nama, level: 'provinsi', alamat_lengkap: p.nama } : null;
  }
  if (k.length === 4) {
    const kb = SEED_KABUPATEN.find((x) => x.kode === k);
    const p = SEED_PROVINSI.find((x) => x.kode === k.slice(0, 2));
    if (!kb) return null;
    const nama = kb.tipe ? `${kb.tipe} ${kb.nama}` : kb.nama;
    return { nama, level: 'kabupaten', alamat_lengkap: [nama, p?.nama].filter(Boolean).join(', ') };
  }
  if (k.length === 6) {
    const kc = SEED_KECAMATAN.find((x) => x.kode === k);
    const kb = SEED_KABUPATEN.find((x) => x.kode === k.slice(0, 4));
    const p = SEED_PROVINSI.find((x) => x.kode === k.slice(0, 2));
    if (!kc) return null;
    const kabNama = kb ? (kb.tipe ? `${kb.tipe} ${kb.nama}` : kb.nama) : '';
    return {
      nama: kc.nama, level: 'kecamatan',
      alamat_lengkap: [`Kecamatan ${kc.nama}`, kabNama, p?.nama].filter(Boolean).join(', '),
    };
  }
  return null;
}

/** Pencarian lokal dari seed (provinsi/kabupaten/kecamatan). */
function searchLocal(q: string, level?: string, limit = 20): AddressResult[] {
  const needle = q.toLowerCase();
  const out: AddressResult[] = [];
  const push = (kode: string, nama: string, lvl: string, alamat: string) => {
    if (out.length >= limit) return;
    out.push({ kode, nama, level: lvl, alamat_lengkap: alamat, source: 'LOCAL' });
  };
  if (!level || level === 'provinsi') {
    for (const p of SEED_PROVINSI) if (p.nama.toLowerCase().includes(needle)) push(p.kode, p.nama, 'provinsi', p.nama);
  }
  if (!level || level === 'kabupaten') {
    for (const k of SEED_KABUPATEN) if (k.nama.toLowerCase().includes(needle)) {
      const lab = localLabel(k.kode); if (lab) push(k.kode, lab.nama, 'kabupaten', lab.alamat_lengkap);
    }
  }
  if (!level || level === 'kecamatan') {
    for (const k of SEED_KECAMATAN) if (k.nama.toLowerCase().includes(needle)) {
      const lab = localLabel(k.kode); if (lab) push(k.kode, lab.nama, 'kecamatan', lab.alamat_lengkap);
    }
  }
  return out;
}

/**
 * Cari alamat di semua level (nama atau kode pos). `level` opsional:
 * provinsi|kabupaten|kecamatan|desa. Hasil dilengkapi alamat lengkap.
 * Bila API tak tersedia → pencarian lokal dari seed (prov/kab/kec).
 */
export async function searchAddress(q: string, opts: { level?: string; limit?: number } = {}): Promise<AddressResult[]> {
  const query = String(q ?? '').trim();
  if (query.length < 2) return [];
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const base = wilayahBaseUrl();
  if (base) {
    const lvl = opts.level ? `&level=${encodeURIComponent(opts.level)}` : '';
    const json = await fetchJson(`${base}/api/alamat/search?q=${encodeURIComponent(query)}${lvl}&limit=${limit}`);
    const items = pickArray(json).map((x: any) => ({
      kode: String(x.kode ?? ''),
      nama: String(x.nama ?? '').trim(),
      level: String(x.level ?? ''),
      tipe: x.tipe ?? null,
      kodepos: x.kodepos ?? null,
      alamat_lengkap: x.alamat_lengkap ?? null,
      source: 'API' as const,
    })).filter((x) => x.kode && x.nama);
    if (items.length > 0) return items;
  }
  return searchLocal(query, opts.level, limit);
}

/** Cari desa/kelurahan dari kode pos (mis. 65161) — hanya via API. */
export async function lookupKodepos(kodePos: string): Promise<AddressResult[]> {
  const base = wilayahBaseUrl();
  const kode = digits(kodePos);
  if (!base || !kode) return [];
  const json = await fetchJson(`${base}/api/kodepos/${encodeURIComponent(kode)}`);
  return pickArray(json).map((x: any) => ({
    kode: String(x.kode ?? ''),
    nama: String(x.nama ?? '').trim(),
    level: String(x.level ?? 'desa'),
    tipe: x.tipe ?? null,
    kodepos: x.kodepos ?? null,
    alamat_lengkap: x.alamat_lengkap ?? null,
    source: 'API' as const,
  })).filter((x) => x.kode && x.nama);
}

/** Susun alamat lengkap resmi dari sebuah kode wilayah (2/4/6/10 digit). */
export async function resolveFullAddress(kode: string): Promise<string | null> {
  const k = digits(kode);
  if (!k) return null;
  const base = wilayahBaseUrl();
  if (base) {
    const json = await fetchJson(`${base}/api/alamat/lengkap?kode=${encodeURIComponent(k)}`);
    const data = json?.data;
    if (data) {
      let full: string | null = data.alamat_lengkap ?? null;
      if (full && data.kode?.level === 'desa' && data.kode?.kodepos && !full.includes(String(data.kode.kodepos))) {
        full = `${full} ${data.kode.kodepos}`;
      }
      if (full) return full;
    }
  }
  return localLabel(k)?.alamat_lengkap ?? null;
}
