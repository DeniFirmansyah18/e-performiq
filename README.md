# E-PerformIQ — Enterprise Employee Performance & Lifecycle Analytics

Sistem manajemen kinerja karyawan terintegrasi berbasis GCG & Employee Lifecycle
(lihat `PRD_Sistem_Penilaian_Karyawan (PT).md`).

## Stack
- **Next.js 14** (App Router) + React 18 + TypeScript
- **Drizzle ORM** di atas **PGlite** (PostgreSQL 16 in-process/WASM), dengan jalur upgrade ke PostgreSQL server
- **Vitest** (unit + integrasi), **Tailwind CSS**, `jose` (JWT), `bcryptjs`, `zod`

## Prasyarat
- Node.js 18+

## Menjalankan (mode PGlite — default, tanpa setup server)
```bash
npm install
npm run db:reset      # buat + migrasi + seed database .pglite/ dari nol
npm run dev           # http://localhost:3000
```

### Akun demo (password seragam: `enterprise2026`)
| Role | Email |
| --- | --- |
| BOD | hendra.gunawan@eperformiq.co.id |
| HR_MANAGER | siti.nurhaliza@eperformiq.co.id |
| PEOPLE_MANAGER | danu.tech@eperformiq.co.id |
| EMPLOYEE | budi.pratama@eperformiq.co.id |
| AUDITOR | bambang.audit@eperformiq.co.id |
| SUPER_ADMIN | admin@eperformiq.co.id |
| ASSESSOR | aris.assessor@eperformiq.co.id |

Halaman login juga menyediakan quick-login 1-klik untuk tiap role.
PIN slip gaji demo (semua karyawan): `123456`.

## Environments
| Variabel | Fungsi |
| --- | --- |
| `JWT_SECRET` | Rahasia penandatanganan sesi. **Wajib di produksi.** |
| `PGLITE_DATA_DIR` | Lokasi file `.pglite` (default `./.pglite`). |
| `DATABASE_URL` | Jika diset, aplikasi memakai **PostgreSQL server** (driver `postgres-js`); jika tidak, jatuh ke PGlite. **Wajib di Vercel/serverless.** Lihat ADR 007. |
| `PORT` | Port dev/prod (default 3000). |
| `AI_PROVIDER` | Provider AI aktif: `gemini` \| `groq`. Bila kosong, dipilih otomatis dari kunci yang tersedia. **Opsional.** |
| `GEMINI_API_KEY` | Kunci API Google Gemini. **Opsional** — lihat ADR 012. |
| `GEMINI_MODEL` | Model Gemini (default `gemini-flash-latest`). |
| `GROQ_API_KEY` | Kunci API Groq (alternatif cepat & gratis). **Opsional.** |
| `GROQ_MODEL` | Model Groq (default `openai/gpt-oss-120b`). Daftar aktif: console.groq.com/docs/models. |

> Salin `.env.example` menjadi `.env.local` untuk memulai.

## Fitur AI (provider-agnostic: Gemini & Groq, opsional)
- **Analisis AI per fitur** — tiap panel dashboard memiliki blok "Analisis AI"
  yang menganalisis data nyata fitur tersebut (endpoint `POST /api/v1/ai/analyze`).
- **Agen Chat AI** — tombol **"Tanya AI"** di Header membuka drawer chat
  (`POST /api/v1/ai/chat`).
- **Dua provider gratis:** Google **Gemini** dan **Groq**. Pilih via `AI_PROVIDER`
  (atau biarkan kosong → otomatis). Bila provider utama **gagal/kena rate limit**
  (429/5xx), otomatis dicoba provider lain yang terkonfigurasi (**fallback**).
- **Tanpa kunci apa pun**, kedua fitur menampilkan pesan ramah `configured:false`
  dengan HTTP 200 (bukan error). Lihat ADR 012.

## Perintah
```bash
npm run dev         # server pengembangan
npm run build       # build produksi + type-check
npm run start       # jalankan hasil build
npm run test        # seluruh test (vitest run)
npm run db:migrate  # terapkan migrasi tertunda (PGlite lokal, atau Postgres bila DATABASE_URL ada)
npm run db:seed     # seed data (idempoten)
npm run db:reset    # hapus .pglite, migrasi ulang, seed ulang (lokal)
npm run db:migrate:pg # migrasi ke PostgreSQL server (butuh DATABASE_URL)
npm run db:seed:pg    # seed ke PostgreSQL server (butuh DATABASE_URL)
```

## Catatan arsitektur
- **PGlite default, Postgres opsional.** PGlite berjalan single-process (tanpa
  replika/HA). Untuk skala multi-server, set `DATABASE_URL` (ADR 007).
- **Otorisasi.** Autentikasi JWT nyata; `middleware.ts` memverifikasi token dan
  membatasi tiap segmen dashboard per role; route API menegakkan RBAC (`assertCan`)
  dan row-level scope (`scope.ts`).
- **Chatbot deterministik** dari `policy_knowledge_base` + data berscope (ADR 006),
  bukan LLM.
- **Angka benchmark & visi-misi** adalah tabel seed (ADR 005); metrik turunan
  dihitung live dari DB.
- **Learning & Development (model Moodle).** Katalog kursus, completion tracking,
  competency framework + evidence, badge, dan learning plan (IDP) diadopsi native ke
  DB (ADR 008). Training/competency dapat menyuplai komponen Competency (DUR-03) GPA
  secara terkonfigurasi dan backward-compatible (ADR 009). Modul tersedia di portal
  karyawan ("Learning & Development") dan panel HR Command Center ("Learning &
  Certification"). Endpoint: `/api/v1/learning/*` (permission `learning:read/write/manage`).
- **Materi kursus & sertifikasi (ADR 011).** Kursus memiliki modul/lesson (TEXT/VIDEO/PDF/QUIZ)
  dengan progres per-modul; menyelesaikan seluruh modul menandai kursus selesai. Kursus wajib
  onboarding otomatis menerbitkan **sertifikat** bernomor & terverifikasi publik. Lihat lesson
  viewer di portal karyawan.
- **Portal Karier publik (ADR 010).** `/careers` (tanpa login): calon karyawan melihat lowongan
  publik, mengirim lamaran (data diri + tautan CV), dan memantau status via nomor lamaran. HR
  mengelola pelamar di panel "Rekrutmen Kandidat".
- **Profil Saya (self-service).** Menu di portal karyawan untuk mengubah field terbatas
  (telepon, alamat, tanggal lahir, kontak darurat, foto, bio); field sensitif (NIP, jabatan,
  gaji) read-only. Perubahan tercatat di `audit_logs`.
- **UI Kartu & navigasi top-bar (ADR 013).** Sidebar dihilangkan; navigasi peran pindah ke
  dropdown `NavMenu` di Header. Tiap dashboard menampilkan **kartu fitur** yang diklik untuk
  membuka panel berisi konten (plus blok Analisis AI). Primitif: `FeatureGrid`, `FeatureCard`,
  `ExpandablePanel`, `AiAnalyzePanel`.

## Catatan pengujian
Test route handler mengimpor route yang memakai singleton `getDb()` (PGlite dev, single-process).
`vitest.config.ts` menetapkan `fileParallelism: false` agar file test tidak membuka file PGlite
yang sama secara bersamaan (menyebabkan abort). Jalankan `npm run db:reset` sebelum suite bila
skema berubah.

## Keputusan arsitektur
Lihat `docs/decisions/` (ADR 003–013).

## Deploy ke Vercel

> ⚠️ **Penting:** Vercel berjalan di **serverless** dengan filesystem **read-only** —
> PGlite (default lokal) **tidak bisa** dipakai di sana. Untuk produksi Anda **wajib**
> menyediakan PostgreSQL server (mis. **Neon** atau **Vercel Postgres**) dan mengeset
> `DATABASE_URL`. Tanpa itu, halaman yang butuh DB akan menampilkan error yang jelas
> (lihat guard di `src/lib/db/client.ts`).

### 1. Siapkan database PostgreSQL (Neon / Vercel Postgres)
1. Buat project di [neon.tech](https://neon.tech) atau tab **Storage → Postgres** pada dashboard Vercel.
2. Salin **connection string** (format `postgres://...?...sslmode=require`). Driver
   memakai `prepare:false` sehingga kompatibel dengan connection pooler (pgbouncer/Supavisor).

### 2. Jalankan migrasi & seed ke database tersebut (dari mesin lokal)
```bash
# Windows PowerShell
$env:DATABASE_URL="postgres://<user>:<pass>@<host>/<db>?sslmode=require"
npm run db:migrate:pg
npm run db:seed:pg
```
> Migrasi idempoten (tracking `__migrations`) dan seed idempoten (`ON CONFLICT DO NOTHING`),
> jadi aman diulang.

### 3. Import repo ke Vercel (via Dashboard)
1. Buka [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → pilih
   `DeniFirmansyah18/e-performiq`.
2. Framework terdeteksi otomatis **Next.js** (konfigurasi dari `vercel.json`).
3. **Environment Variables** (Production & Preview):

   | Variabel | Nilai |
   | --- | --- |
   | `JWT_SECRET` | string acak ≥32 karakter (wajib) |
   | `DATABASE_URL` | connection string dari langkah 1 (wajib) |
   | `GEMINI_API_KEY` | kunci Gemini (opsional) |
   | `GEMINI_MODEL` | `gemini-2.0-flash` (opsional) |

   > Jangan set `PGLITE_DATA_DIR` di Vercel.

4. Klik **Deploy**.

### 4. Verifikasi pasca-deploy
- Buka `https://<project>.vercel.app/login` → login demo (mis. `budi.pratama@eperformiq.co.id` / `enterprise2026`).
- Pastikan dashboard memuat data (bukan error DB).

### Mode CLI (opsional, jika memakai Vercel CLI)
```bash
npm i -g vercel
vercel login                 # login pakai akun Anda
vercel link                  # tautkan folder ke project Vercel
vercel env add JWT_SECRET production
vercel env add DATABASE_URL production
vercel --prod                # deploy ke production
```

