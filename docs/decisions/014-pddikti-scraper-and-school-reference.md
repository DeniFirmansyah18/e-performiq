# ADR 014 - Integrasi Scraper PDDikti & Data Sekolah (referensi pendidikan)

Status: Diterima
Tanggal: 2026-10-04

## Konteks

Form lamaran (WS-13) pada field **Riwayat Pendidikan** memerlukan pencarian
**sekolah dan perguruan tinggi** yang akurat saat kandidat mengisi sekolah/kampus.
Sumber resmi yang tersedia:

- **PDDikti** (Kemdiktisaintek) — data perguruan tinggi + program studi. API resmi
  kini dilindungi verifikasi Cloudflare ("saya manusia"), sehingga tidak dapat
  dipanggil langsung dari server serverless tanpa clearance.
- **Data Referensi / "Sekolah Kita"** (Kemendikdasmen) — data sekolah SD/SMP/SMA/SMK.

Selain itu tersedia **layanan scraper mandiri `pddikti-pt-api`** (FastAPI) yang
membungkus PDDikti: menangani clearance Cloudflare, menyediakan endpoint bersih
(`/api/pt/search`, `/api/pt/{id}`, `/api/pt/{id}/prodi`, `/api/pt/filter`,
`/api/health`), serta **mode demo** agar dapat dicoba tanpa clearance.

## Keputusan

1. **Sumber PT berlapis (best-effort) di `educationReferenceService.ts`:**
   1. **Scraper API sendiri** (`PDDIKTI_API_URL`) — sumber utama bila dikonfigurasi.
      Respons `{ ok, source, data: [{ id, kode, nama, nama_singkat }] }` dipetakan
      menjadi `InstitutionResult` (membawa `externalId` = `id` base64url PDDikti).
   2. **Endpoint resmi PDDikti** + gateway komunitas (fallback bila scraper mati).
   3. **Seed lokal** `education_institutions` (selalu tersedia, dijamin).
2. **Sumber sekolah:** "Sekolah Kita" Kemendikdasmen sebagai prioritas, fallback
   ke API publik `api-sekolah-indonesia`, lalu seed lokal.
3. **Detail PT + prodi** diekspos lewat proxy server
   `GET /api/v1/reference/pt/{id}?withProdi=1&tahun=YYYYYS` → `getPtDetail()`.
   Klien **tidak pernah** memanggil scraper langsung (hindari CORS & kebocoran URL).
4. **Semua panggilan best-effort + timeout** (4–8 dtk). Kegagalan API **tidak
   pernah** memblokir UI; kandidat tetap dapat mengetik bebas (allowFreeText).
5. Hasil API di-**cache** ke tabel `education_institutions` (idempoten
   `ON CONFLICT (name, level) DO NOTHING`) sehingga pencarian berikutnya tetap
   tersedia walau API sedang down.
6. `externalId` hanya dipakai untuk lookup detail/prodi secara live dan **tidak
   disimpan** ke DB; kolom `institution_code` tetap menyimpan `kode` PT/NPSN.

## Konsekuensi

- Aplikasi berfungsi penuh tanpa scraper (fallback lokal). 
- Bila `PDDIKTI_API_URL` kosong → fitur detail/prodi otomatis nonaktif
  (`source: 'NONE'`), pencarian tetap jalan via seed lokal.
- URL scraper bersifat konfigurasi (env), aman untuk dev lokal maupun deployment.
- Menambah satu titik integrasi eksternal yang perlu dipantau (health scraper).

## Konfigurasi

| Env | Fungsi |
|---|---|
| `PDDIKTI_API_URL` | Base URL scraper `pddikti-pt-api` (mis. `http://127.0.0.1:8000`). Kosong = nonaktif. |

Menjalankan scraper (dari repo `pddikti-pt-api`): `run.bat` (Windows) lalu set
`PDDIKTI_API_URL=http://127.0.0.1:8000`. Untuk data nyata, selesaikan verifikasi
Cloudflare sekali via `PDDIKTI_AUTO_COOKIE=1`; untuk uji cepat pakai
`PDDIKTI_DEMO_MODE=1`.
