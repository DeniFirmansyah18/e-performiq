# ADR 018 - Pembuatan Soal Tes Teknis dengan AI (dengan Gerbang Persetujuan HR)

Status: Diterima
Tanggal: 2026-10-04

## Konteks

HR membutuhkan bank soal **tes teknis** per posisi. Menyusun manual lambat dan
mudah tidak konsisten antar posting. Tersedia layanan AI provider-agnostic
(Gemini/Groq/OpenRouter, lihat ADR 012) yang dapat menghasilkan soal pilihan
ganda dari deskripsi posisi.

Namun soal hasil AI **tidak boleh** langsung dilihat kandidat: kualitas,
relevansi, dan kebocoran kunci jawaban harus dikendalikan manusia (HR).

## Keputusan

Soal teknis dibuat AI lalu **wajib disetujui HR** sebelum aktif
(`src/lib/services/technicalTestGenerator.ts`):

- **`generateTechnicalQuestions(db, opts)`** — HR memilih posting
  (`positionId`), jumlah, tingkat kesulitan (`EASY|MEDIUM|HARD`), dan bahasa.
  AI menghasilkan soal + pilihan + kunci. Baris disisipkan ke
  `assessment_questions` dengan:
  - `type = 'MCQ'`, `source = 'AI'`, `source_ref = posting.id`,
  - **`is_active = FALSE`** (status **DRAFT**) — tidak terlihat kandidat.
  - `difficulty` diisi dari permintaan/normalisasi.
- **`listDraftQuestions(db, positionId)`** — antrean DRAFT untuk direview HR.
- **`approveQuestion(db, questionId, { approvedBy })`** — HR menyetujui →
  `is_active = TRUE` (dan menandai penyetuju), sehingga soal masuk ke bank aktif.

**Gerbang kandidat (DRAFT gate)**: `assessmentService.getQuestions` secara
default hanya mengembalikan `is_active = TRUE`. `startAttempt`/`submitAttempt`
memakai soal aktif saja, sehingga **kandidat tidak pernah** menerima soal DRAFT.
HR (review) memakai opsi `{ includeInactive: true }` untuk melihat draft.

AI bersifat **advisory**: keluaran mesin dinormalisasi/divalidasi
(`normalizeQuestion`) dan tetap tunduk pada keputusan HR.

## Konsekuensi

- Tidak ada soal berkualitas rendah/bocor yang sampai ke kandidat tanpa review.
- Beban HR turun (draft otomatis) namun kontrol kualitas tetap di manusia.
- Bila AI tak terkonfigurasi/gagal → tidak ada soal dibuat (tidak fatal);
  HR dapat menambah soal manual. Lihat ADR 012 untuk perilaku provider.
- Sumber AI tercatat (`source='AI'`, `source_ref`) untuk audit & pembersihan.
- Kualitas soal adalah tanggung jawab reviewer (HR), bukan sistem.

## Alternatif yang Ditolak

- **Generate lalu langsung aktif** — risiko soal buruk/bocor ke kandidat.
- **Bank soal manual saja** — lambat dan tidak konsisten.
