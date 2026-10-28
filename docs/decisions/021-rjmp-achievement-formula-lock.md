# ADR 021 — Penguncian Rumus Capaian RJMP & Disclosure Cakupan Pengukuran

**Status:** Diterima
**Tanggal:** 2026-10-28
**Versi rumus:** `RJMP-2026-v1`
**Konteks terkait:** Spec `2026-10-25-bod-boardroom-narasi-4-design.md` §4, ADR 004 (immutability & scope), ISO 30414, UU Cipta Kerja No. 6/2023 (PP 35/2021)

## Konteks

1. Dashboard eksekutif (Boardroom Cockpit) menampilkan capaian pilar strategis dan capaian RJMP yang diturunkan darinya. Angka ini bukan sekadar informasi: ia menjadi dasar penilaian Direksi dan dapat mengekor ke remunerasi/tantiem.
2. Kontrak API sempat memakai dua basis berbeda untuk angka yang sama. Satu varian mengeluarkan pilar tanpa KPI dari penyebut (*renormalisasi*), varian lain mempertahankannya. Pada data contoh, keduanya menghasilkan angka yang sangat berbeda untuk periode yang sama (92,8 vs 69,6) sehingga laporan bergantung pada implementasi, bukan pada kesepakatan.
3. Renormalisasi menciptakan **insentif yang salah**: skor naik hanya dengan tidak menyusun KPI pada pilar yang sulit diukur. Dalam praktik, KPI yang tidak tercapai cenderung "dihapus" periode berikutnya, lalu skor membaik tanpa perbaikan kinerja apa pun.
4. Sebaliknya, satu angka capaian tidak dapat memikul dua arti sekaligus. Angka 69,6 terbaca sebagai "hanya mencapai 69,6% dari target", padahal sebagian bobotnya **tidak diukur**, bukan gagal. Dua kondisi itu menuntut tindakan manajemen yang berbeda total.
5. Ditemukan pula bahwa cascade KPI korporat → KPI individual belum terbentuk: keempat `corporate_kpis` tidak memiliki satu pun `individual_kpis` yang cocok dengan `position_kpi_templates`. Ini lubang proses (HR/PMO), bukan kesalahan perhitungan.

## Keputusan

### 1. Satu rumus resmi, dikunci di dokumen

Capaian resmi = **rata-rata tertimbang SELURUH pilar**:

```
capaian_resmi = Σ (capaian_pilar_i × bobot_i) / Σ bobot_i
```

- Pilar tanpa KPI bernilai **0% pada bobotnya sendiri** dan **tidak** dikeluarkan dari penyebut.
- Renormalisasi (mengeluarkan pilar tanpa data dari penyebut) **dilarang** untuk angka resmi.
- Implementasi tunggal: `src/lib/strategy/achievementFormula.ts`.
- Versi basis: `RJMP-2026-v1`. Versi ini **diumumkan pada payload API** (`formulaVersion`) agar setiap laporan dapat ditelusuri ke basis perhitungannya.

### 2. Cakupan pengukuran wajib dilaporkan terpisah

| Metrik | Pertanyaan yang dijawab |
|---|---|
| `overallAchievementPercentage` | Seberapa baik kinerja korporat (angka resmi) |
| `measurementCoveragePercentage` + `measuredWeight`/`totalWeight` | Seberapa besar strategi yang benar-benar terukur |
| `measuredAchievementPercentage` | Capaian pada bagian yang terukur (konteks, **bukan** angka resmi) |
| `measured` per pilar | Pilar itu *belum dinilai* atau *di bawah target* |

Alasan: ISO 30414 menuntut disclosure cakupan data, bukan hanya nilainya. Tanpa pemisahan ini, pembaca menyimpulkan sebab yang salah.

### 3. Pilar belum dinilai ≠ gagal

- Status `NO_DATA` diberi label **"Belum dinilai"** di UI, bukan "gagal"/"0%".
- Narasi AI wajib menerima `measurementCoverage` dan dilarang menyebut pilar `measured:false` sebagai kinerja buruk.
- Setiap highlight yang menyebut pilar belum dinilai **wajib menyebutkan nama pilar dan tindakan cascade-nya**.

### 4. Register cascade gap

Aplikasi wajib menyediakan daftar kerja: untuk setiap `corporate_kpis`, berapa template jabatan yang menaunginya, dan berapa di antaranya yang sudah punya KPI individual cocok. KPI dengan nol kecocokan masuk `analysis.cascadeGaps` beserta daftar posisi yang wajib diberi KPI. Ini mengubah gejala ("1 pilar belum dinilai") menjadi pekerjaan yang dapat ditugaskan.

### 5. Aturan dua periode (governance finding)

Pilar yang tidak memiliki KPI selama **dua periode berturut-turut** menjadi temuan tata kelola:

- Kode: `UNMEASURED_CONSECUTIVE_PERIODS`, tingkat `GOVERNANCE`.
- Dilaporkan pada `analysis.governanceFindings` beserta daftar periode dan nama pilar.
- Tampil sebagai blok merah "Temuan Tata Kelola" di panel, dan diteruskan ke konteks AI agar dieskalasi pada narasi BOD.
- Satu periode tanpa KPI tetap sekadar informasi; baru menjadi temuan pada periode kedua.

## Konsekuensi

1. Angka capaian resmi dapat **turun** ketika sebuah pilar belum diukur. Ini disengaja: termometer harus menunjukkan lubang, bukan menyembunyikannya. Yang diperbaiki adalah cascade-nya, bukan rumusnya.
2. Setiap perubahan rumus wajib: (a) revisi ADR ini, (b) kenaikan `ACHIEVEMENT_FORMULA_VERSION`, (c) pembaruan test golden. `tests/unit/achievementFormula.test.ts` membaca berkas ADR ini dan gagal bila versi di dokumen berbeda dari versi di kode.
3. Penetapan KPI individual untuk pilar yang masih kosong adalah **keputusan bisnis** (HR/PMO + pemilik proses), bukan keputusan teknis. Aplikasi hanya menyediakan register dan bukti penutupannya.

## Alternatif yang ditolak

| Alternatif | Alasan ditolak |
|---|---|
| Renormalisasi pilar tanpa data | Membuat skor naik karena tidak menyusun KPI; mengubah basis penilaian Direksi di tengah periode |
| Menampilkan hanya satu angka (tanpa cakupan) | Menyamakan "belum diukur" dengan "gagal"; melanggar prinsip disclosure cakupan |
| Menghitung capaian dari `corporate_kpis.target_value` saja | `target_value` bukan capaian; tidak ada realisasi pada tabel itu, sehingga angka akan dikarang |
| Menyimpan rumus di konfigurasi yang dapat diubah saat runtime | Basis penilaian Direksi tidak boleh dapat berubah tanpa jejak tata kelola |