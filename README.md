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
| `DATABASE_URL` | Jika diset, targetkan driver PostgreSQL server (lihat ADR 007). |
| `PORT` | Port dev/prod (default 3000). |

## Perintah
```bash
npm run dev         # server pengembangan
npm run build       # build produksi + type-check
npm run start       # jalankan hasil build
npm run test        # seluruh test (vitest run)
npm run db:migrate  # terapkan migrasi tertunda
npm run db:seed     # seed data (idempoten)
npm run db:reset    # hapus .pglite, migrasi ulang, seed ulang
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

## Catatan pengujian
Test route handler mengimpor route yang memakai singleton `getDb()` (PGlite dev, single-process).
`vitest.config.ts` menetapkan `fileParallelism: false` agar file test tidak membuka file PGlite
yang sama secara bersamaan (menyebabkan abort). Jalankan `npm run db:reset` sebelum suite bila
skema berubah.

## Keputusan arsitektur
Lihat `docs/decisions/` (ADR 003–011).
