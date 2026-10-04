# ADR 015 - Integrasi Wilayah Alamat API & Auto-fill CV (form lamaran)

Status: Diterima
Tanggal: 2026-10-04

## Konteks

Form lamaran (WS-13) memiliki field **Alamat** (teks bebas) dan fitur unggah CV
yang mengisi otomatis sebagian field. Dua peningkatan diminta:

1. **Auto-fill CV lebih lengkap** — hasil scan CV (ATS) mengisi *semua* kolom yang
   dapat diekstrak, sehingga kandidat minim input manual.
2. **Alamat terstruktur** — field alamat memakai sumber data wilayah resmi
   Indonesia: Provinsi → Kabupaten/Kota → Kecamatan → Desa/Kelurahan + Kode Pos.

Tersedia layanan mandiri **`wilayah-alamat-api`** (FastAPI, tanpa API key) berbasis
dataset publik `kodepos-id` (standar kode wilayah Kemendagri), dengan endpoint
`/api/wilayah/*`, `/api/alamat/search`, `/api/alamat/lengkap`, `/api/kodepos/{kode}`.

## Keputusan

1. **Ekstraksi alamat di parser CV** (`resumeParser.ts`): tambah `gender`, `nik`,
   `address`, `city`, `province`, `postalCode` ke `ParsedResume` — heuristik
   (regex) + AI (prompt JSON), digabung lewat `mergeParsed`.
2. **Auto-fill di `ApplicationForm`**: `applyParsed` mengisi field data diri
   (termasuk NIK, jenis kelamin, tanggal lahir) dan **alamat** (jalan + provinsi/
   kota/kode pos) dari hasil scan CV.
3. **Layanan alamat** `addressReferenceService.ts`: proxy server-side ke
   `wilayah-alamat-api` (`WILAYAH_API_URL`), fungsi: `listProvinces/Kabupaten/
   Kecamatan/Desa`, `searchAddress`, `lookupKodepos`, `resolveFullAddress`.
4. **Route proxy baru** (publik, best-effort):
   - `GET /api/v1/reference/wilayah?level=...&parent=...`
   - `GET /api/v1/reference/address/search?q=...&level=...&limit=...`
   - `GET /api/v1/reference/kodepos/{kode}`
5. **Komponen `AddressSelect.tsx`**: dropdown bertingkat 4 level + pencarian kode
   pos yang otomatis mengisi hierarki, ringkasan alamat lengkap, dan **mode
   ketik manual** bila layanan tak aktif.
6. **Best-effort**: semua panggilan eksternal diberi timeout; bila
   `WILAYAH_API_URL` kosong/mati → array kosong / `null`, **tidak pernah**
   memblokir form. Alamat tetap dapat diketik manual.

## Konsekuensi

- Field alamat di DB (`candidates.address`) menyimpan alamat lengkap terkomposisi
  (jalan, desa, kecamatan, kota, provinsi, kode pos) sebagai satu string.
- Aplikasi tetap berfungsi tanpa layanan wilayah.
- `WILAYAH_API_URL` bersifat konfigurasi (dev lokal vs deployment).

## Konfigurasi

| Env | Fungsi |
|---|---|
| `WILAYAH_API_URL` | Base URL `wilayah-alamat-api` (mis. `http://127.0.0.1:8001`). Kosong = nonaktif. |

Jalankan layanan (repo `wilayah-alamat-api`): `run.bat` → otomatis mengunduh
dataset & seed DB lokal (sekali), lalu set `WILAYAH_API_URL=http://127.0.0.1:8001`.
