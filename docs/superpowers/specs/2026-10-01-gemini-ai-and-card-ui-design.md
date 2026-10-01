# Spec: Integrasi Gemini (Analisis AI + Agent Chat) & UI Kartu (tanpa Sidebar)

**Tanggal:** 2026-10-01
**Status:** Menunggu review
**Terkait:** PRD §5/§6/§7, ADR 007 (PGlite single-process), ADR 010-011
**Melanjutkan:** branch `master` (merge `380f7f9`)

---

## 1. Tujuan & Kriteria Sukses

1. **Integrasi Gemini** untuk **analisis data per fitur**: setiap fitur punya tombol "Analisis AI" yang
   mengirim ringkasan datanya ke Gemini dan menampilkan wawasan + rekomendasi.
2. **AI Agent chat** global: pengguna bertanya seputar aplikasi/data; Gemini menjawab dengan konteks aplikasi.
3. **UI kartu tanpa sidebar**: isi tiap dashboard menjadi **kartu-kartu** sub-fitur yang terbuka saat diklik;
   **sidebar dihapus**, navigasi pindah ke **menu dropdown di top bar**; **top bar & tampilan lain dipertahankan**.

**Kriteria sukses:**
1. `npm run test` hijau; `npm run build` sukses; `npm run db:reset` sukses.
2. Dengan `GEMINI_API_KEY` diset, tombol "Analisis AI" mengembalikan wawasan dari Gemini; tanpa kunci,
   UI menampilkan pesan jelas ("AI belum dikonfigurasi") tanpa crash.
3. Chat agent menjawab pertanyaan tentang data aplikasi (menggunakan ringkasan konteks dari DB).
4. Semua dashboard memakai grid kartu responsif (3/2/1 kolom); klik kartu membuka panel isi fitur.
5. **Sidebar hilang**; navigasi portal/modul berfungsi dari top bar (role-aware).
6. Tidak ada fitur lama yang hilang (semua konten tetap dapat diakses via panel kartu).

---

## 2. Latar & Temuan
- Belum ada SDK/kunci Gemini. Aplikasi berjalan di PGlite (single-process, tanpa server eksternal) di Next.js
  App Router — Gemini akan dipanggil **server-side** dari route API (kunci aman, tidak terekspos ke browser).
- Shell saat ini: `Header` (top bar gelap) + `Sidebar` (navigasi role-aware) + `main`. Redesign: pertahankan
  `Header`, **hapus `Sidebar`**, tambah dropdown navigasi di `Header`, dan ubah isi `main` menjadi kartu.

---

## 3. Ruang Lingkup

### WS-1 — Gemini Service & Route API
- `src/lib/services/aiService.ts`:
  - `isAiConfigured(): boolean` (`!!process.env.GEMINI_API_KEY`).
  - `generateContent(prompt: string, opts?): Promise<{ text: string; configured: boolean }>` —
    memanggil REST `https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL||'gemini-2.0-flash'}:generateContent?key=...`
    via `fetch` (tanpa SDK). Bila kunci tidak ada → `{ configured:false, text:'AI belum dikonfigurasi...' }`.
    Bila error HTTP → melempar/`configured:true` dengan pesan error ramah.
  - `buildFeatureContext(feature: string, db: Db): Promise<object>` — merakit ringkasan data nyata per fitur
    (mis. `executive`→ VMAI + 4 perspektif; `hr`→ MPP/QoH/pipeline; `learning`→ kursus/progress/sertifikat;
    dsb.) sebagai objek ringkas untuk prompt.
  - `analyzeFeature(db, feature, session): Promise<{ insight: string; configured: boolean }>` — menyusun prompt
    (peran + ringkasan + instruksi) lalu `generateContent`.
  - `chat(db, messages, session): Promise<{ reply: string; configured: boolean }>` — menyertakan ringkasan
    konteks aplikasi (agregat kunci) ke sistem prompt.
- Routes:
  - `POST /api/v1/ai/analyze` — body `{ feature: string }`; RBAC mengikuti fitur (mis. `analytics:read`,
    `learning:read`, dst.); mengembalikan `{ insight, configured }`.
  - `POST /api/v1/ai/chat` — body `{ messages: [{role,content}] }`; terautentikasi; `{ reply, configured }`.
  - `GET /api/v1/ai/status` — `{ configured: boolean }` (untuk UI menyembunyikan/menandai tombol).
- Permission baru: `ai:read` (semua role terautentikasi).
- **Fallback**: tanpa kunci, `configured:false` + pesan; route tetap 200 (bukan 500).

### WS-2 — Shell: hapus Sidebar, navigasi di top bar
- Modify `src/app/dashboard/layout.tsx`: hapus `<Sidebar/>`; `main` menjadi full-width.
- Modify `src/components/navigation/Header.tsx`: tambah **menu dropdown "Portal" & "Modul"** (role-aware,
  memakai daftar yang sama dari `Sidebar.tsx`) + tombol **"Tanya AI"** (buka chat drawer) + indikator AI
  (status `configured`).
- Create `src/components/navigation/NavMenu.tsx`: dropdown role-aware (Core Portals + Modules & Governance
  + bottom items: Panduan, Settings, GCG Policy Archive).
- Delete/retire `src/components/navigation/Sidebar.tsx` (dipindah isinya ke NavMenu; komponen lama dihapus).
- Create `src/components/ai/AiChatDrawer.tsx`: drawer kanan; kirim ke `/api/v1/ai/chat`; menampilkan pesan
  + status bila belum dikonfigurasi.

### WS-3 — UI Kartu (pola di semua dashboard)
- Create `src/components/ui/FeatureCard.tsx`: kartu (ikon, judul, deskripsi, metrik opsional, tag) — tombol
  aksesibel (keyboard), lift-on-hover.
- Create `src/components/ui/FeatureGrid.tsx` + `src/components/ui/ExpandablePanel.tsx`: grid responsif
  (3/2/1 kolom) + panel yang terbuka saat kartu diklik (berisi konten fitur + blok "Analisis AI").
- Create `src/components/ai/AiAnalyzePanel.tsx`: memanggil `/api/v1/ai/analyze` untuk `feature` terkait;
  menampilkan loading, insight, tombol "Analisis ulang".
- Refactor tiap dashboard (`executive`, `hr-command`, `manager-cockpit`, `employee-portal`, `ninebox-matrix`,
  `audit-governance`) agar isinya dipecah menjadi sub-fitur **kartu**; konten lama dipindah ke dalam panel.
  - Pemetaan sub-fitur per halaman (contoh):
    - `executive`: VMAI, Perspektif BSC, Tren, Succession/TARIF.
    - `hr-command`: MPP/Rekrutmen, Probation, Offboarding/Clearance, Learning & Certification, Cost/Risk.
    - `manager-cockpit`: Roster Tim, Approval KPI, Evaluasi GPA, SOP Adherence.
    - `employee-portal`: Scorecard GPA, Learning & Development, Sertifikat, Profil Saya, Timesheet/Payslip, dll.
    - `ninebox-matrix`: Distribusi 9-Box, Inspection Panel, Simulasi.
    - `audit-governance`: TARIF, Metrik Kepatuhan, Audit Log.
- Kartu menampilkan 1 metrik kunci bila tersedia (dari API yang sudah ada) agar scannable.

### WS-4 — Konfigurasi, Verifikasi, ADR
- `.env.example`: tambah `GEMINI_API_KEY=` dan `GEMINI_MODEL=gemini-2.0-flash` (dokumentasi; kunci asli di `.env.local`).
- ADR `012-gemini-integration.md`, `013-card-ui-shell.md`.
- Verifikasi: test hijau + build + `db:reset` + smoke (kartu buka/tutup, chat drawer, fallback tanpa kunci).

---

## 4. Non-Goals
- Streaming realtime token-demi-token (dipakai respons non-stream dulu untuk kesederhanaan).
- Vector database / RAG penuh (chat memakai ringkasan konteks agregat, bukan embedding).
- Fine-tuning model, function-calling/tool-use kompleks.
- Menyimpan riwayat chat ke DB (state di client saja).
- Menghapus/mengubah fungsi fitur lama (hanya presentasi yang berubah).

---

## 5. Risiko & Mitigasi
| Risiko | Mitigasi |
|---|---|
| Kunci Gemini bocor ke client | Panggilan hanya di route server (`aiService`), tidak pernah di komponen client |
| Tanpa kunci → crash | `configured:false` + pesan ramah; route 200; UI menandai "belum dikonfigurasi" |
| Biaya/limit API | Respons pendek (`maxOutputTokens` dibatasi), prompt ringkas; tidak ada auto-loop |
| Redesign memutus fungsi | Konten lama hanya dipindah ke panel; test route yang ada tetap dijalankan |
| `Header` makin besar | Navigasi dipisah ke `NavMenu`; chat ke `AiChatDrawer` |
| Perubahan test karena Sidebar dihapus | Tidak ada test yang mengimpor Sidebar (verifikasi saat eksekusi) |

---

## 6. Keputusan Owner (brainstorm)
1. Kunci: diisi sendiri di `.env.local` (`GEMINI_API_KEY`).
2. Model: `gemini-2.0-flash` (override via `GEMINI_MODEL`); panggilan **REST fetch** (tanpa SDK).
3. Tanpa kunci: **graceful fallback** + pesan jelas.
4. AI: **tombol "Analisis AI" di dalam panel** + **chat agent global**.
5. Kartu: **responsif 3/2/1 kolom**, sub-fitur jadi kartu, diterapkan di **semua dashboard**.
6. **Sidebar dihapus**; navigasi pindah ke **dropdown top bar**; top bar & tampilan lain dipertahankan.
7. Semua fungsi lama dipertahankan (hanya presentasi berubah).
