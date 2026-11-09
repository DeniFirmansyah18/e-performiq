# Desain — Halaman 9-Box untuk HRD Pemula

**Tanggal:** 2026-11-09
**Status:** Menunggu persetujuan
**Rencana:** `docs/superpowers/plans/YYYY-MM-DD-ninebox-pemula.md` (ditulis setelah disetujui)

## 1. Maksud & alasan

HRD yang membuka `/dashboard/ninebox-matrix` sekarang melihat nama kotak berbahasa
Inggris (`Enigma`, `Growth Star`, `Core Player`), satu kalimat rekomendasi berjargon
(`Fast-Track Leadership`, `Key SME Retention`, `Subject Matter Expert`), dan slider
potensi 1.0–5.0 tanpa acuan. Halaman ini **tidak punya satu pun teks bantuan** —
tidak ada tooltip, legenda, atau penjelasan arti kotak.

Tujuannya: HRD **pemula** yang awam konsep 9-box bisa membuka halaman ini lalu
langsung tahu, untuk tiap kotak, **siapa isinya** dan **apa yang harus dilakukan**.

Pengguna yang dituju adalah HRD pemula — bukan lagi HRD berpengalaman. Ini
**membatalkan** batasan "tidak membuat mode pemula" pada desain sebelumnya
(lihat §8, keputusan yang berubah).

## 2. Tujuan

- Tiap kotak punya nama yang bisa dibayangkan orang awam, plus satu kalimat
  penjelasan awam yang selalu terlihat.
- Saat kotak dibuka, HRD tahu **apa yang sedang terjadi**, **langkah pertama**,
  dan **apa yang perlu dicek dulu** — bukan hanya daftar nama.
- Angka ringkasan di atas grid menjawab "ke mana saya harus lihat dulu".
- Slider potensi punya acuan yang sesuai ambang nyata sistem.

## 3. Bukan tujuan

- **Tidak** mengubah rumus GPA/9-Box (`gpa-engine.ts` tidak disentuh).
- **Tidak** mengubah API atau skema DB. `nine_box_quadrant` tetap menyimpan kode
  huruf besar; terjemahan hanya di lapisan tampilan.
- **Tidak** mengubah nama internal (`FUTURE_LEADER`, `quadrantKey`) — 13 berkas tes
  dan beberapa API bergantung padanya.
- **Tidak** menyentuh tombol "Download Matriks PDF" dan "Simulasi Talent Pool"
  yang masih memanggil `alert()`.

**Anti-tujuan (gagal walau secara teknis jalan):** menuliskan saran yang seolah-olah
pasti benar untuk semua konteks. Contoh ditolak: "Pindahkan ke proyek lain" sebagai
perintah — karena penyebabnya bisa beban kerja, bukan peran.

## 4. Batasan

- Penjelasan **selalu tampil** untuk semua orang, dengan tombol
  **"Sembunyikan penjelasan"**; pilihan yang disembunyikan disimpan di
  `localStorage` (kunci `epq:ninebox:showHelp`, default `true`).
- Label slider harus sesuai ambang nyata `gpa-engine.ts`:
  potensi `< 3.0` rendah, `3.0–3.9` sedang, `≥ 4.0` tinggi. Angka asli tetap
  ditampilkan agar presisi tidak hilang.
- Bila data gagal dimuat, tampilkan **"Data belum tersedia"** — angka cadangan demo
  (1.240 / 42 / 180 / 12) dibuang.

## 5. Pendekatan yang dipertimbangkan

| Pendekatan | Trade-off | Hasil |
|---|---|---|
| (a) Satu kalimat per kotak saja | Ringkas, tapi meninggalkan pertanyaan "lalu saya harus apa" | ditolak |
| **(b) Kalimat singkat di kotak + penjelasan lengkap saat dibuka** | Dua tingkat kedalaman; grid tetap bisa dipindai | **dipilih** |
| (c) (b) + contoh tindakan konkret per kotak | Berisiko jadi saran yang tidak cocok untuk semua konteks | ditolak |

Disetujui pemilik produk: **(b)**, dengan penjelasan selalu tampil dan tombol
sembunyikan untuk HRD berpengalaman.

## 6. Istilah pengganti

Nama pendek dipakai untuk 8 kotak agar grid tetap bisa dipindai; subteks posisi
ditampilkan kecil di bawah nama. Kotak `ENIGMA` memakai nama posisional karena
istilah lamanya tidak informatif sama sekali.

| Kode internal | Nama tampil | Subteks posisi |
|---|---|---|
| `FUTURE_LEADER` | Pemimpin Masa Depan | potensi tinggi · kinerja tinggi |
| `GROWTH_STAR` | Bintang Berkembang | potensi tinggi · kinerja sedang |
| `ENIGMA` | Potensi Tinggi, Kinerja Rendah | potensi tinggi · kinerja rendah |
| `HIGH_IMPACT` | Pakar Berdampak | potensi sedang · kinerja tinggi |
| `CORE_PLAYER` | Penggerak Inti | potensi sedang · kinerja sedang |
| `DILEMMA` | Perlu Penyesuaian | potensi sedang · kinerja rendah |
| `TRUSTED_PRO` | Profesional Andalan | potensi rendah · kinerja tinggi |
| `EFFECTIVE_PRO` | Kontributor Terampil | potensi rendah · kinerja sedang |
| `UNDERPERFORMER` | Perlu Pembinaan | potensi rendah · kinerja rendah |

Istilah proses:

| Sekarang | Menjadi |
|---|---|
| Moderasi & Kalibrasi | Kalibrasi Penilaian |
| Sidang Komite Kalibrasi | Rapat Kalibrasi |
| Risalah / Justifikasi | Catatan Alasan |
| Forced Distribution Gaussian | Sebaran Nilai Wajib |

Satu peta bersama (`src/lib/employee/nineBoxLabels.ts`) menjadi satu-satunya sumber
teks kotak, dipakai oleh `NineBoxGrid.tsx`, `ninebox-matrix/page.tsx`, dan
`faqData.ts` agar tidak saling bertentangan.

## 7. Bentuk layar

**Kartu ringkas** di atas grid:

```
┌─────────────────┬──────────────────┬──────────────────┐
│ Perlu perhatian │ Siap dipromosikan│ Perlu dijaga     │
│       8 orang   │      12 orang    │      45 orang    │
│  Kotak 1–3      │   Kotak 7–9      │   Kotak 4–6      │
└─────────────────┴──────────────────┴──────────────────┘
```

**Grid** — tiap kotak: nama, subteks posisi, satu kalimat awam, jumlah orang, dan
tombol `Kalibrasi karyawan di kotak ini`.

**Saat kotak dibuka** — tiga bagian:
1. **Sedang terjadi** — apa yang sebenarnya terjadi pada orang di kotak ini
2. **Langkah pertama** — satu tindakan konkret, bukan label jargon
3. **Yang perlu dicek dulu** — pertanyaan pemandu sebelum memutuskan

Contoh `ENIGMA`:

> **Sedang terjadi:** orang ini punya kapasitas untuk naik level, tapi hasil
> kerjanya sekarang belum sesuai target.
>
> **Langkah pertama:** cek dulu apakah masalahnya beban kerja, peran yang tidak
> cocok, atau memang belum kompeten — jangan langsung simpulkan "tidak mampu".
>
> **Yang perlu dicek:** Apakah dia baru pindah peran? Apakah targetnya realistis?
> Apakah ada hambatan yang bukan salahnya?

**Label slider potensi** (`Potensi rendah` < 3.0 · `Potensi sedang` 3.0–3.9 ·
`Potensi tinggi` ≥ 4.0), angka asli tetap terlihat.

## 8. Keputusan yang berubah dari desain sebelumnya

| Sebelumnya | Sekarang | Alasan |
|---|---|---|
| "Tidak membuat mode pemula" | Penjelasan untuk pemula ditambahkan | Pengguna yang dituju ternyata pemula |
| Nama kotak posisional untuk semua | Nama pendek + subteks posisi | Semua posisional membuat grid penuh teks |
| Penjelasan disembunyikan (opsi) | Selalu tampil + tombol sembunyikan | Pemula tidak akan menemukan yang tersembunyi |

## 9. Yang diserahkan ke pelaksana

- Susunan tata letak tepat kartu ringkas dan tombol sembunyikan.
- Kalimat penjelasan sembilan kotak ("sedang terjadi", "langkah pertama", "yang
  perlu dicek") — draf di §7 adalah contoh untuk satu kotak; sisanya mengikuti pola
  dan nada yang sama, Bahasa Indonesia sehari-hari, tanpa jargon.
- Nama berkas tes dan bentuk stub.
