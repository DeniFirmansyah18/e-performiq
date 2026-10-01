# ADR 012 - Integrasi AI Server-Side (provider-agnostic: Gemini & Groq)

Status: Diterima
Tanggal: 2026-10-01 (diperbarui 2026-10-02: multi-provider)

## Konteks

Produk membutuhkan analisis berbasis AI per fitur ("Analisis AI") serta agen chat
yang membantu pengguna memahami data SDM & kinerja. Kunci API bersifat rahasia
dan tidak boleh terekspos ke klien. Aplikasi berjalan di Next.js 14 App Router
dengan PGlite (lokal) / PostgreSQL server (produksi).

## Keputusan

1. Semua panggilan AI dilakukan **server-side** melalui `src/lib/services/aiService.ts`
   menggunakan `fetch` REST (tanpa SDK), sehingga tidak menambah dependensi.
2. **Provider-agnostic:** mendukung **Google Gemini** dan **Groq** (API bergaya OpenAI).
   - Pilih via `AI_PROVIDER` (`gemini` | `groq`); bila kosong -> dipilih otomatis dari
     provider yang punya kunci (Gemini diprioritaskan).
   - Kunci: `GEMINI_API_KEY` / `GROQ_API_KEY`. Model: `GEMINI_MODEL`
     (default `gemini-flash-latest`) / `GROQ_MODEL` (default `llama-3.3-70b-versatile`).
   - `gemini-flash-latest` dipilih agar tidak "mati" saat Google menghentikan versi
     lama (mis. `gemini-2.0-flash` yang sudah retired).
3. **Fallback otomatis:** bila provider utama gagal dengan error sementara
   (rate limit `429` / server `5xx` / network), otomatis dicoba provider lain yang
   terkonfigurasi - meningkatkan keandalan di tier gratis.
4. **Graceful fallback**: tanpa kunci, layanan mengembalikan
   `{ configured: false, text: 'AI belum dikonfigurasi...' }` dengan HTTP **200**
   (bukan 500). Error HTTP dikembalikan sebagai pesan ramah + field `error`.
5. Konteks data nyata dibangun oleh `src/lib/services/aiContext.ts`.
6. Ekspos melalui `/api/v1/ai/{status,analyze,chat}` dengan RBAC `ai:read`.

## Konsekuensi

- Rahasia tidak pernah menyentuh bundel klien.
- Aplikasi tetap berfungsi penuh tanpa AI (mode info, bukan error).
- Tidak ada SDK pihak ketiga; mudah diaudit.
- Dapat berganti/backup provider tanpa mengubah fitur (kontrak `generateContent` stabil).
- Biaya/kuota terkendali karena prompt dibatasi (`maxOutputTokens`).

## Alternatif yang ditolak

- **SDK pihak ketiga**: menambah dependensi & berat untuk kebutuhan sederhana.
- **Panggilan dari klien**: membocorkan kunci API.
- **Satu provider saja**: rentan saat provider kena rate limit/overload (tier gratis).
