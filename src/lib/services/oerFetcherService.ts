/**
 * Pengambil materi dari sumber yang MENGIZINKAN pengambilan otomatis.
 *
 * Hanya penyedia dengan API publik / lisensi terbuka yang disentuh:
 *   - Openverse (CC Search)  : api.openverse.org
 *   - Internet Archive       : archive.org/advancedsearch.php
 *
 * Penyedia lain (Coursera, Udemy, LinkedIn, AWS, dsb.) TIDAK diambil
 * otomatis: ToS mereka melarang scraping. Untuk penyedia itu materi hanya
 * DITAUTKAN (redirect), bukan disalin.
 *
 * Semua fungsi di sini bersifat best-effort: kegagalan jaringan
 * mengembalikan array kosong, bukan melempar galat.
 */

import { bolehDiambilOtomatis, type OerResource } from './oerCatalogService';

/** Batas waktu satu permintaan (ms). */
const TIMEOUT_MS = 8000;

async function ambilJson(url: string): Promise<any | null> {
  if (!bolehDiambilOtomatis(url)) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    /* jaringan gagal / diblokir: bukan alasan menggagalkan permintaan */
    return null;
  }
}

/**
 * Cari media berlisensi terbuka di Openverse (gambar/audio/video CC).
 *
 * Hasil dimaksudkan sebagai bahan pendukung materi, bukan pengganti kursus.
 */
export async function cariOpenverse(kueri: string, limit = 5): Promise<OerResource[]> {
  const q = kueri.trim();
  if (q.length < 2) return [];
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=${Math.min(limit, 20)}`;
  const json = await ambilJson(url);
  const hasil = json?.results ?? [];
  if (!Array.isArray(hasil)) return [];
  return hasil
    .filter((r: any) => typeof r?.foreign_landing_url === 'string')
    .slice(0, limit)
    .map((r: any) => ({
      title: String(r.title ?? r.foreign_landing_url).slice(0, 200),
      url: r.foreign_landing_url,
      provider: 'Openverse',
      topics: [q.toLowerCase()],
    }));
}

/** Kelompokkan media Internet Archive menurut koleksi yang relevan. */
const KOLEKSI_IA: Record<string, string> = {
  education: 'opensource_audio',
  kursus: 'opensource',
  training: 'opensource',
};

/**
 * Cari materi berlisensi terbuka di Internet Archive.
 *
 * Hanya item dengan lisensi CC/Public Domain yang dikembalikan.
 */
export async function cariInternetArchive(kueri: string, limit = 5): Promise<OerResource[]> {
  const q = kueri.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({
    q: `${q} AND (licenseurl:*creativecommons* OR licenseurl:*publicdomain*)`,
    'fl[]': 'identifier,title,licenseurl',
    rows: String(Math.min(limit, 20)),
    output: 'json',
  });
  // URLSearchParams menulis 'fl[]' sebagai fl%5B%5D — diterima oleh API.
  const url = `https://archive.org/advancedsearch.php?${params.toString()}`;
  const json = await ambilJson(url);
  const docs = json?.response?.docs ?? [];
  if (!Array.isArray(docs)) return [];
  return docs
    .filter((d: any) => typeof d?.identifier === 'string')
    .slice(0, limit)
    .map((d: any) => ({
      title: String(d.title ?? d.identifier).slice(0, 200),
      url: `https://archive.org/details/${encodeURIComponent(d.identifier)}`,
      provider: 'Internet Archive',
      topics: [q.toLowerCase()],
    }));
}

/**
 * Cari materi dari SEMUA sumber yang mengizinkan pengambilan otomatis.
 * Hasil digabung dan dibatasi.
 */
export async function cariMateriOtomatis(kueri: string, limit = 6): Promise<OerResource[]> {
  const [openverse, archive] = await Promise.all([
    cariOpenverse(kueri, Math.ceil(limit / 2)),
    cariInternetArchive(kueri, Math.ceil(limit / 2)),
  ]);
  return [...openverse, ...archive].slice(0, limit);
}

/** Penjelasan singkat mengapa sebuah penyedia tidak diambil otomatis. */
export function alasanTidakDiambilOtomatis(url: string): string {
  return bolehDiambilOtomatis(url)
    ? 'Penyedia ini mengizinkan pengambilan otomatis.'
    : 'Penyedia ini tidak mengizinkan pengambilan otomatis; materi hanya ditautkan (redirect).';
}
