# ADR 017 - Penilaian Psikometri dengan Item Response Theory (IRT 2PL/3PL)

Status: Diterima
Tanggal: 2026-10-04

## Konteks

Tes psikometri sebelumnya diskor dengan **CTT** (Classical Test Theory) sederhana:
persentase jawaban benar. CTT menganggap semua item setara, sehingga skor
bergantung pada komposisi soal yang diberikan dan tidak menghasilkan estimasi
kemampuan yang invarian terhadap pilihan item.

Untuk rekrutmen (seleksi kandidat) dibutuhkan estimasi **kemampuan laten (θ)**
yang lebih stabil lintas form/bank soal.

## Keputusan

Menerapkan **Item Response Theory (IRT)** pada mesin terpisah `irt-engine.ts`
(murni/deterministik, tanpa I/O):

- **Model**: 3PL `p(θ) = c + (1−c) · σ(a(θ − b))`; reduksi otomatis ke **2PL**
  bila `c = 0`. `a` = diskriminasi, `b` = kesulitan, `c` = tebakan semu.
  `c` dijaga pada rentang wajar `0..0.35`.
- **Estimasi θ**: **EAP** (Expectation A Posteriori) atas grid kuadratur
  `θ ∈ [−4, 4]` (langkah 0.1) dengan **prior N(0,1)**; jika likelihood nol di
  seluruh grid → fallback **MLE** (argmax grid).
- **Konversi skor**: `thetaToScore` memetakan θ → persentil 0..100 via CDF normal
  baku, agar konsisten dengan skala komponen lain.
- **Informasi tes**: `itemInformation`/`testInformation` (Fisher) tersedia untuk
  analisis bank soal.
- **Integrasi**: `assessmentService` memakai `scoreIrt` untuk item Likert
  (PSIKOMETRI) **bila item punya parameter** (`irt_a`/`irt_b`); jika tidak →
  **fallback CTT**. Jadi kompatibilitas mundur tetap terjaga.

## Parameter

Kolom `irt_a NUMERIC(6,3)`, `irt_b NUMERIC(6,3)` sejak migrasi `0012`;
`irt_c NUMERIC(6,3)` ditambahkan di migrasi `0020_irt_parameters.sql`.
Nilai parameter awal di-seed **heuristik** (per item, lihat `assessment-seed.ts`
dan backfill di `seed/index.ts`) — bukan hasil kalibrasi empiris.

## Konsekuensi

- Skor psikometri lebih stabil dan hanya bergantung pada respons + parameter,
  bukan panjang/komposisi form.
- **Kalibrasi dari data nyata = pekerjaan masa depan.** Parameter saat ini
  heuristik; akurasi θ meningkat setelah ada cukup respons untuk
  mengestimasi a/b/c (mis. dengan EM/MCMC). Sampai itu, tetap ada fallback CTT.
- Mesin tanpa dependensi eksternal → mudah diuji (`irt-engine.test.ts`) dan
  deterministik (tidak ada efek waktu/URNG).

## Referensi

Lihat `docs/SOURCES.md` untuk atribusi buku IRT rujukan dan lisensi item
inventori kepribadian (IPIP, domain publik).

## Alternatif yang Ditolak

- **Tetap CTT** — skor tidak invarian terhadap form; kurang cocok untuk bank soal.
- **Kalibrasi langsung** — belum ada volume data; parameter akan bising.
