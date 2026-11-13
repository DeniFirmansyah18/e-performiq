/**
 * Pemeriksa kesehatan tautan OER.
 *
 * Tujuan: kursus hasil "Generate dengan AI" TIDAK boleh menunjuk tautan yang
 * sudah mati (404/410) atau yang sebenarnya berbayar.
 *
 * Dua lapis pemeriksaan:
 *   1. Statis  — penyedia tidak ada di daftar berbayar (lihat PROVIDER_BERBAYAR),
 *                domain harus di-whitelist, skema wajib https.
 *   2. Jaringan — permintaan HEAD/GET ringan memastikan tautan masih hidup.
 *
 * Pemeriksaan jaringan bersifat best-effort: kegagalan jaringan (timeout,
 * diblokir) TIDAK membuat tautan dianggap mati, karena penyebabnya bisa lokal.
 * Hanya status 404/410 yang dianggap benar-benar mati.
 */

import { isTrustedOerUrl, type OerResource } from './oerCatalogService';

/** Penyedia khusus berbayar (tautannya hanya halaman jualan). */
const PROVIDER_BERBAYAR = ['udemy', 'skillshare', 'pluralsight', 'linkedin learning', 'datacamp'];

/** Penanda situs berbayar pada URL. */
const URL_BERBAYAR = ['/checkout', '/cart', '/purchase', '/subscribe', 'price=', '/pricing'];

const TIMEOUT_MS = 7000;

export interface HasilPemeriksaan {
  url: string;
  hidup: boolean;
  gratis: boolean;
  alasan: string | null;
}

/**
 * Pemeriksaan statis: domain, skema, dan indikasi berbayar.
 * Tidak melakukan permintaan jaringan sehingga cepat & aman dipakai di tes.
 */
export function periksaStatisOer(url: string, provider?: string): HasilPemeriksaan {
  const hasil: HasilPemeriksaan = { url, hidup: true, gratis: true, alasan: null };

  if (!url || !url.trim()) {
    return { url, hidup: false, gratis: false, alasan: 'Tautan kosong.' };
  }

  // Periksa berbayar LEBIH DULU agar alasannya tepat, bukan sekadar
  // "domain tidak tepercaya" (membingungkan bila domainnya memang dikenal).
  const rendah = url.toLowerCase();
  const nama = (provider ?? '').toLowerCase();
  if (PROVIDER_BERBAYAR.some((p) => rendah.includes(p.replace(/\s+/g, '')) || nama.includes(p))) {
    return { url, hidup: false, gratis: false, alasan: 'Penyedia ini berbayar.' };
  }
  if (URL_BERBAYAR.some((p) => rendah.includes(p))) {
    return { url, hidup: false, gratis: false, alasan: 'Tautan mengarah ke halaman pembelian/langganan.' };
  }

  if (!isTrustedOerUrl(url)) {
    return {
      url,
      hidup: false,
      gratis: false,
      alasan: 'Domain tidak termasuk daftar penyedia OER tepercaya.',
    };
  }

  return hasil;
}

/**
 * Pemeriksaan jaringan: apakah tautan masih merespons.
 *
 * Hanya 404/410 yang dianggap mati; galat jaringan dianggap "tidak diketahui"
 * sehingga tautan tetap dipakai (lebih baik daripada menghapus materi sah
 * hanya karena server pemeriksa tidak punya akses internet).
 */
export async function periksaTautanHidup(url: string): Promise<{ hidup: boolean; alasan: string | null }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    // HEAD lebih ringan; sebagian situs menolak HEAD, jadi jatuh ke GET.
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal });
    }
    clearTimeout(t);
    if (res.status === 404 || res.status === 410) {
      return { hidup: false, alasan: `Tautan tidak ditemukan (HTTP ${res.status}).` };
    }
    return { hidup: true, alasan: null };
  } catch {
    // Timeout / tanpa jaringan / diblokir: bukan bukti tautan mati.
    return { hidup: true, alasan: null };
  }
}

/**
 * Periksa satu sumber OER (statis + jaringan).
 */
export async function periksaSumberOer(res: OerResource): Promise<HasilPemeriksaan> {
  const statis = periksaStatisOer(res.url, res.provider);
  if (!statis.hidup || !statis.gratis) return statis;

  const jaringan = await periksaTautanHidup(res.url);
  if (!jaringan.hidup) {
    return { url: res.url, hidup: false, gratis: true, alasan: jaringan.alasan };
  }
  return statis;
}

/**
 * Saring sekumpulan sumber: buang yang tidak gratis / mati.
 *
 * Pemeriksaan jaringan dijalankan paralel agar tidak lambat bila kandidat
 * banyak, dan dibatasi agar tidak membanjiri penyedia.
 */
export async function saringSumberValid(
  daftar: OerResource[],
  opts: { periksaJaringan?: boolean; maksimal?: number } = {}
): Promise<OerResource[]> {
  const { periksaJaringan = true, maksimal = 12 } = opts;
  const kandidat = daftar.slice(0, maksimal);

  const hasil = await Promise.all(
    kandidat.map(async (res) => {
      const statis = periksaStatisOer(res.url, res.provider);
      if (!statis.hidup || !statis.gratis) return null;
      if (!periksaJaringan) return res;
      const jaringan = await periksaTautanHidup(res.url);
      return jaringan.hidup ? res : null;
    })
  );

  return hasil.filter((r): r is OerResource => r !== null);
}
