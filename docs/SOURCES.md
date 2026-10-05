# Sumber & Atribusi (Third-Party Sources)

Dokumen ini mencatat sumber pihak ketiga yang dipakai/diadaptasi proyek
E-PerformIQ beserta lisensinya, untuk kepatuhan atribusi.

## 1. Item Response Theory (IRT) — referensi buku

- **Sumber:** `aswinjanuarsjaf/Buku_IRT` (referensi buku Item Response Theory,
  teks penjelasan model 2PL/3PL & estimasi θ).
- **Penggunaan:** rujukan konseptual untuk `src/lib/engines/irt-engine.ts`
  (fungsi respons 3PL, informasi Fisher, estimasi θ dengan EAP). Implementasi
  kode ditulis sendiri (murni/deterministik), bukan salinan.
- **Keputusan terkait:** ADR 017.

## 2. IPIP — International Personality Item Pool

- **Sumber:** **IPIP** (International Personality Item Pool), https://ipip.ori.org
- **Lisensi:** Item IPIP berada di **domain publik**.
- **Penggunaan:** item inventori kepribadian (tes psikometri) pada bank soal.
- **Catatan:** meskipun domain publik, atribusi tetap dicantumkan sebagai
  praktik baik.

## 3. Editor / pustaka pihak ketiga (dependensi)

Semua dependensi npm (Next.js, React, Drizzle ORM, PGlite, Vitest, Tailwind,
`jose`, `bcryptjs`, `zod`, `lucide-react`, dll.) mengikuti lisensi
masing-masing (umumnya MIT/ISC); lihat `package.json` dan lockfile untuk daftar
lengkap.

## 4. Layanan eksternal (opsional, tidak dipaketkan)

- **Gemini / Groq / OpenRouter** — penyedia AI (ADR 012).
- **wilayah-alamat-api** — data wilayah & kode pos (ADR 015), berbasis dataset
  kode wilayah Kemendagri.

> Bila menambahkan sumber pihak ketiga baru (data, kode, atau model), tambahkan
> entri atribusi di sini dan tautkan dari ADR terkait.
