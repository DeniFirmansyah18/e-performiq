# ADR 012 â€” Integrasi AI Gemini Server-Side

Status: Diterima
Tanggal: 2026-10-01

## Konteks

Produk membutuhkan analisis berbasis AI per fitur ("Analisis AI") serta agen chat
yang membantu pengguna memahami data SDM & kinerja. Kunci API bersifat rahasia
dan tidak boleh terekspos ke klien. Aplikasi berjalan di Next.js 14 App Router
dengan PGlite (single-process, tanpa layanan eksternal).

## Keputusan

1. Semua panggilan Gemini dilakukan **server-side** melalui `src/lib/services/aiService.ts`
   menggunakan `fetch` REST ke `generativelanguage.googleapis.com` (tanpa SDK),
   sehingga tidak menambah dependensi dan tetap ringan.
2. Kunci dibaca dari `process.env.GEMINI_API_KEY`; model dari `GEMINI_MODEL`
   (default `gemini-flash-latest`).
3. **Graceful fallback**: tanpa kunci, layanan mengembalikan `{ configured: false, text: 'AI belum dikonfigurasiâ€¦' }`
   dengan HTTP **200** â€” bukan 500. Error HTTP dari Gemini juga dikembalikan
   sebagai pesan ramah + field `error`, tidak melempar exception ke pengguna.
4. Konteks data nyata dibangun oleh `src/lib/services/aiContext.ts` (ringkasan agregat
   per fitur, tidak pernah melempar).
5. Ekspos melalui `/api/v1/ai/{status,analyze,chat}` dengan RBAC `ai:read`
   (semua peran) dan `getAuthSession` â†’ 401 bila tak terautentikasi.

## Konsekuensi

- Rahasia tidak pernah menyentuh bundel klien.
- Aplikasi tetap berfungsi penuh tanpa AI (mode info, bukan error).
- Tidak ada SDK pihak ketiga; mudah diaudit.
- Biaya/kuota Gemini terkendali karena prompt dibatasi (`maxOutputTokens`).

## Alternatif yang ditolak

- **SDK `@google/generative-ai`**: menambah dependensi & berat untuk kebutuhan sederhana.
- **Panggilan dari klien**: membocorkan kunci API.
