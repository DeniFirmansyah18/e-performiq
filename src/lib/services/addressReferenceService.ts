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
}

/** Base URL layanan wilayah (kosong → fitur alamat nonaktif). */
export function wilayahBaseUrl(): string | null {
  const raw = (process.env.WILAYAH_API_URL ?? '').trim();
  return raw ? raw.replace(/\/+$/, '') : null;
}

export function isAddressConfigured(): boolean {
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

/** Daftar provinsi. */
export async function listProvinces(): Promise<WilayahItem[]> {
  const base = wilayahBaseUrl();
  if (!base) return [];
  const json = await fetchJson(`${base}/api/wilayah/provinsi`);
  return pickArray(json).map(mapItem).filter((x) => x.kode && x.nama);
}

/** Daftar kabupaten/kota dalam sebuah provinsi (kode 2 digit). */
export async function listKabupaten(provinsi: string): Promise<WilayahItem[]> {
  const base = wilayahBaseUrl();
  if (!base) return [];
  const kode = digits(provinsi);
  if (!kode) return [];
  const json = await fetchJson(`${base}/api/wilayah/kabupaten?provinsi=${encodeURIComponent(kode)}`);
  return pickArray(json).map(mapItem).filter((x) => x.kode && x.nama);
}

/** Daftar kecamatan dalam sebuah kabupaten/kota (kode 4 digit). */
export async function listKecamatan(kabupaten: string): Promise<WilayahItem[]> {
  const base = wilayahBaseUrl();
  if (!base) return [];
  const kode = digits(kabupaten);
  if (!kode) return [];
  const json = await fetchJson(`${base}/api/wilayah/kecamatan?kabupaten=${encodeURIComponent(kode)}`);
  return pickArray(json).map(mapItem).filter((x) => x.kode && x.nama);
}

/** Daftar desa/kelurahan dalam sebuah kecamatan (kode 6 digit). */
export async function listDesa(kecamatan: string): Promise<WilayahItem[]> {
  const base = wilayahBaseUrl();
  if (!base) return [];
  const kode = digits(kecamatan);
  if (!kode) return [];
  const json = await fetchJson(`${base}/api/wilayah/desa?kecamatan=${encodeURIComponent(kode)}`);
  return pickArray(json).map(mapItem).filter((x) => x.kode && x.nama);
}

/**
 * Cari alamat di semua level (nama atau kode pos). `level` opsional:
 * provinsi|kabupaten|kecamatan|desa. Mengembalikan hasil dengan alamat lengkap.
 */
export async function searchAddress(q: string, opts: { level?: string; limit?: number } = {}): Promise<AddressResult[]> {
  const base = wilayahBaseUrl();
  const query = String(q ?? '').trim();
  if (!base || query.length < 2) return [];
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const lvl = opts.level ? `&level=${encodeURIComponent(opts.level)}` : '';
  const json = await fetchJson(`${base}/api/alamat/search?q=${encodeURIComponent(query)}${lvl}&limit=${limit}`);
  return pickArray(json).map((x: any) => ({
    kode: String(x.kode ?? ''),
    nama: String(x.nama ?? '').trim(),
    level: String(x.level ?? ''),
    tipe: x.tipe ?? null,
    kodepos: x.kodepos ?? null,
    alamat_lengkap: x.alamat_lengkap ?? null,
  })).filter((x) => x.kode && x.nama);
}

/** Cari desa/kelurahan dari kode pos (mis. 65161). */
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
  })).filter((x) => x.kode && x.nama);
}

/** Susun alamat lengkap resmi dari sebuah kode wilayah (2/4/6/10 digit). */
export async function resolveFullAddress(kode: string): Promise<string | null> {
  const base = wilayahBaseUrl();
  const k = digits(kode);
  if (!base || !k) return null;
  const json = await fetchJson(`${base}/api/alamat/lengkap?kode=${encodeURIComponent(k)}`);
  const data = json?.data;
  if (!data) return null;
  let full: string | null = data.alamat_lengkap ?? null;
  if (full && data.kode?.level === 'desa' && data.kode?.kodepos && !full.includes(String(data.kode.kodepos))) {
    full = `${full} ${data.kode.kodepos}`;
  }
  return full;
}
