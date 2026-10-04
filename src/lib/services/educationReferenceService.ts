/**
 * Education Reference Service (WS-13) — pencarian institusi pendidikan (sekolah/kampus)
 * dan jurusan / program studi untuk dropdown kandidat.
 *
 * Sumber:
 *  - Sekolah: Data Referensi / "Sekolah Kita" Kemendikdasmen
 *             (`referensi.data.kemdikbud.go.id` — sumber resmi, tanpa key).
 *             Fallback: API publik `api-sekolah-indonesia.vercel.app`.
 *  - Kampus:  PDDIKTI (`api-pddikti.kemdikbud.go.id`) + gateway komunitas (best-effort).
 *  - Fallback lokal: tabel `education_institutions` + `education_majors` (selalu tersedia).
 *
 * Prinsip: TIDAK boleh memblokir UI. Bila API eksternal lambat/mati → kembalikan
 * hasil fallback lokal (best-effort + timeout). Kandidat tetap dapat ketik bebas.
 */
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export interface InstitutionResult {
  name: string;
  level: string | null;      // SD|SMP|SMA/SMK|PT
  code: string | null;       // NPSN / kode PT
  city: string | null;
  province: string | null;
  source: 'LOCAL' | 'API';
}

async function fetchJson(url: string, timeoutMs = 4000): Promise<any | null> {
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

/** Deteksi jenjang dari kata kunci nama. */
export function guessLevel(name: string): string | null {
  const n = name.toLowerCase();
  if (/\b(sd|sdn|sdit|mi|min)\b/.test(n)) return 'SD';
  if (/\b(smp|smpn|mts|mtsn)\b/.test(n)) return 'SMP';
  if (/\b(sma|sman|smk|smkn|ma|man|smks)\b/.test(n)) return 'SMA/SMK';
  if (/\b(universitas|university|institut|institute|politeknik|sekolah tinggi|akademi|kampus|ugm|ui|itb|its|unpad|undip|ub|unair)\b/.test(n)) return 'PT';
  return null;
}

/**
 * Cari perguruan tinggi (PT) dari API PDDIKTI (Kemdikbud) — sumber resmi.
 * Endpoint publik PDDIKTI: GET /api/pencarian/universitas/{keyword}
 * Disediakan beberapa mirror/gateway sebagai fallback (best-effort).
 */
async function searchCampusesApi(q: string): Promise<InstitutionResult[]> {
  const enc = encodeURIComponent(q);
  const urls = [
    // Resmi PDDIKTI
    `https://api-pddikti.kemdikbud.go.id/api/pencarian/universitas/${enc}`,
    `https://pddikti.kemdikbud.go.id/api/pencarian/universitas/${enc}`,
    // Gateway komunitas (fallback)
    `https://api-pddikti.vercel.app/api/v1/pencarian/universitas?query=${enc}&limit=10`,
  ];
  for (const url of urls) {
    const json = await fetchJson(url, 6000);
    const arr = pickCampusArray(json);
    if (arr && arr.length > 0) {
      const mapped = arr.slice(0, 12).map(mapCampus).filter((x: InstitutionResult) => !!x.name);
      if (mapped.length > 0) return mapped;
    }
  }
  return [];
}

/** Ambil array data kampus dari berbagai bentuk respons PDDIKTI/gateway. */
function pickCampusArray(json: any): any[] | null {
  if (!json) return null;
  if (Array.isArray(json)) return json;
  for (const k of ['data', 'result', 'universitas', 'list', 'items', 'results']) {
    if (Array.isArray(json[k])) return json[k];
    if (json[k] && Array.isArray(json[k].data)) return json[k].data;
  }
  return null;
}

/** Petakan objek kampus PDDIKTI → InstitutionResult (toleran terhadap variasi nama field). */
function mapCampus(x: any): InstitutionResult {
  return {
    name: String(x.nama ?? x.name ?? x.nama_pt ?? x.nama_universitas ?? '').trim(),
    level: 'PT',
    code: x.kode_pt ?? x.kode ?? x.id ?? x.kode_pt_id ?? null,
    city: x.kabupaten_kota ?? x.kota ?? x.city ?? x.kabupaten ?? null,
    province: x.propinsi ?? x.province ?? x.provinsi ?? null,
    source: 'API' as const,
  };
}

/**
 * Cari sekolah (SD/SMP/SMA/SMK) — PRIORITAS sumber resmi "Sekolah Kita"
 * (Data Referensi Kemendikdasmen): `referensi.data.kemdikbud.go.id`.
 * Bila tak tersedia → fallback ke API publik `api-sekolah-indonesia.vercel.app`.
 */
async function searchSchoolsApi(q: string): Promise<InstitutionResult[]> {
  const primary = await searchSchoolsKemendikdasmen(q);
  if (primary.length > 0) return primary;
  return searchSchoolsIndoApi(q);
}

/**
 * Sumber resmi: Data Referensi / Sekolah Kita (Kemendikdasmen).
 * Endpoint pencarian: GET /pencarian?q={keyword} (mengembalikan JSON bila diminta).
 * Disediakan beberapa varian path/mirror; toleran terhadap variasi bentuk respons.
 */
async function searchSchoolsKemendikdasmen(q: string): Promise<InstitutionResult[]> {
  const enc = encodeURIComponent(q);
  const urls = [
    `https://referensi.data.kemdikbud.go.id/pencarian?q=${enc}`,
    `https://referensi.data.kemdikbud.go.id/sekolah/search?keyword=${enc}`,
    `https://sekolah.data.kemdikbud.go.id/api/sekolah?keyword=${enc}&limit=10`,
    `https://sekolah.data.kemdikbud.go.id/pencarian?q=${enc}`,
  ];
  for (const url of urls) {
    const json = await fetchJson(url, 6000);
    const arr = pickSchoolArray(json);
    if (arr && arr.length > 0) {
      const mapped = arr.slice(0, 10).map(mapKemendikdasmenSchool).filter((x) => !!x.name);
      if (mapped.length > 0) return mapped;
    }
  }
  return [];
}

/** Ambil array data sekolah dari berbagai bentuk respons Data Referensi. */
function pickSchoolArray(json: any): any[] | null {
  if (!json) return null;
  if (Array.isArray(json)) return json;
  for (const k of ['data', 'result', 'results', 'sekolah', 'list', 'items', 'rows', 'dataSekolah']) {
    if (Array.isArray(json[k])) return json[k];
    if (json[k] && Array.isArray(json[k].data)) return json[k].data;
    if (json[k] && Array.isArray(json[k].rows)) return json[k].rows;
  }
  return null;
}

/** Petakan objek sekolah Data Referensi → InstitutionResult (toleran variasi field). */
function mapKemendikdasmenSchool(x: any): InstitutionResult {
  const name = String(
    x.nama_sekolah ?? x.nama ?? x.sekolah ?? x.name ?? x.nama_satuan_pendidikan ?? '',
  ).trim();
  const bentuk = x.bentuk_pendidikan ?? x.bentuk ?? x.jenjang ?? null;
  return {
    name,
    level: bentuk ? normalizeSchoolLevel(String(bentuk)) : guessLevel(name),
    code: x.npsn != null ? String(x.npsn) : (x.kode_sekolah ?? x.kode ?? null),
    city: x.kabupaten_kota ?? x.kabupaten ?? x.kota ?? x.kecamatan ?? null,
    province: x.propinsi ?? x.provinsi ?? x.province ?? null,
    source: 'API' as const,
  };
}

/** Normalisasi label bentuk pendidikan Kemendikdasmen → jenjang ringkas. */
function normalizeSchoolLevel(bentuk: string): string | null {
  const b = bentuk.trim().toUpperCase();
  if (b.includes('SD') || b.includes('MI') || b.includes('SEKOLAH DASAR')) return 'SD';
  if (b.includes('SMP') || b.includes('MTS') || b.includes('MENENGAH PERTAMA')) return 'SMP';
  if (b.includes('SMA') || b.includes('SMK') || b.includes('MA') || b.includes('MENENGAH ATAS')) return 'SMA/SMK';
  return guessLevel(bentuk);
}

/** Fallback: API publik `api-sekolah-indonesia.vercel.app` (best-effort). */
async function searchSchoolsIndoApi(q: string): Promise<InstitutionResult[]> {
  const json = await fetchJson(`https://api-sekolah-indonesia.vercel.app/sekolah/s?sekolah=${encodeURIComponent(q)}&perPage=10`);
  const arr = json?.dataSekolah ?? json?.data ?? null;
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 10).map((x: any) => ({
    name: String(x.sekolah ?? '').trim(),
    level: x.bentuk ? normalizeSchoolLevel(String(x.bentuk)) : guessLevel(String(x.sekolah ?? '')),
    code: x.npsn ?? null,
    city: x.kabupaten_kota ?? null,
    province: x.propinsi ?? null,
    source: 'API' as const,
  })).filter((x: InstitutionResult) => x.name);
}

/** Cari institusi lokal dari DB (fallback & pelengkap). */
async function searchInstitutionsLocal(db: Db, q: string): Promise<InstitutionResult[]> {
  const like = `%${q}%`;
  const res = (await db.execute(sql`
    SELECT name, level, code, city, province FROM education_institutions
     WHERE name ILIKE ${like}
     ORDER BY name LIMIT 10
  `)) as unknown as { rows: Array<{ name: string; level: string | null; code: string | null; city: string | null; province: string | null }> };
  return (res.rows ?? []).map((r) => ({ ...r, source: 'LOCAL' as const }));
}

/**
 * Cari institusi pendidikan berdasarkan kata kunci.
 * Menggabungkan hasil API (sekolah + kampus) dengan fallback lokal, tanpa duplikat.
 */
export async function searchInstitutions(db: Db, q: string): Promise<InstitutionResult[]> {
  const query = String(q ?? '').trim();
  if (query.length < 2) return [];

  const level = guessLevel(query);
  const tasks: Array<Promise<InstitutionResult[]>> = [];
  // Prioritaskan sumber spesifik jenjang lebih dulu agar hasil API di depan.
  if (level === 'PT') {
    tasks.push(searchCampusesApi(query));   // PDDIKTI (resmi) — hasil utama
    tasks.push(searchInstitutionsLocal(db, query));
    tasks.push(searchSchoolsApi(query));    // pelengkap, bila kata kunci ambigu
  } else {
    tasks.push(searchSchoolsApi(query));    // api-sekolah-indonesia
    tasks.push(searchInstitutionsLocal(db, query));
    tasks.push(searchCampusesApi(query));   // pelengkap
  }

  const settled = await Promise.all(tasks);
  const merged: InstitutionResult[] = [];
  const seen = new Set<string>();
  for (const list of settled) {
    for (const item of list) {
      const key = `${item.name.toLowerCase()}|${item.level ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }
  const result = merged.slice(0, 15);

  // Cache hasil API ke tabel lokal (best-effort, agar pencarian berikutnya
  // tetap tersedia walau API sedang down).
  void cacheInstitutions(db, result.filter((r) => r.source === 'API'));
  return result;
}

/** Simpan hasil API ke tabel lokal (idempoten, best-effort). */
async function cacheInstitutions(db: Db, items: InstitutionResult[]): Promise<void> {
  if (items.length === 0) return;
  for (const it of items) {
    try {
      await db.execute(sql`
        INSERT INTO education_institutions (name, level, code, city, province)
        VALUES (${it.name}, ${it.level}, ${it.code}, ${it.city}, ${it.province})
        ON CONFLICT (name, level) DO NOTHING
      `);
    } catch { /* abaikan */ }
  }
}

/** Cari jurusan / program studi (lokal + cadangan statis). */
export async function searchMajors(db: Db, q: string): Promise<Array<{ name: string; groupName: string | null }>> {
  const query = String(q ?? '').trim();
  if (query.length < 2) {
    const res = (await db.execute(sql`SELECT name, group_name AS "groupName" FROM education_majors ORDER BY name LIMIT 20`)) as unknown as { rows: any[] };
    return res.rows ?? [];
  }
  const like = `%${query}%`;
  const res = (await db.execute(sql`
    SELECT name, group_name AS "groupName" FROM education_majors
     WHERE name ILIKE ${like} ORDER BY name LIMIT 20
  `)) as unknown as { rows: any[] };
  return res.rows ?? [];
}
