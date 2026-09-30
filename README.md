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

## Keputusan arsitektur
Lihat `docs/decisions/` (ADR 003–007).
