# Desain — Bersihkan Tombol Palsu & Persentase Palsu di Halaman 9-Box

**Tanggal:** 2026-11-09
**Status:** Menunggu persetujuan
**Rencana:** `docs/superpowers/plans/YYYY-MM-DD-ninebox-palsu.md`

## 1. Maksud & alasan

Dua jenis data palsu masih tampil di `/dashboard/ninebox-matrix`:

1. **Tujuh tombol yang tidak melakukan apa pun.** Enam memanggil `alert()` berisi
   janji ("Mengunduh Laporan…", "Membuka audit dossier…", "Opsi Tata Kelola…"),
   satu ("Simulasi Talent Pool Suksesi") hanya menyegarkan angka yang sudah ada —
   tidak ada simulasi. Pengguna mengira sudah menekan sesuatu yang bekerja.
2. **Sembilan persentase hardcoded** (`0.6%`, `Top 3.4%`, `14.5%`, …) tampil di tiap
   kotak seolah sebaran talenta organisasi. Angkanya bukan dari data, dan totalnya
   tidak konsisten 100%.

Keduanya kelas cacat yang sama: **angka/aksi palsu lebih buruk daripada kosong.**

## 2. Tujuan

- Halaman tidak lagi menjanjikan aksi yang tidak terjadi.
- Persentase per kotak dihitung dari data nyata dan konsisten dengan kartu ringkas.

## 3. Bukan tujuan

- Tidak membuat fitur PDF laporan maupun simulasi talent pool. Keduanya **pekerjaan
  terpisah** dan dicatat sebagai follow-up (lihat §7).
- Tidak mengubah API, skema DB, atau rumus 9-Box.
- Tidak mengubah tiga kartu ringkas (sudah dari data nyata).

## 4. Keputusan pemilik produk

| Hal | Keputusan |
|---|---|
| Tombol tanpa fungsi | **Disembunyikan** (opsi a), bukan dibuat sekarang |
| Persentase per kotak | **Dihitung dari data nyata** (opsi c), bukan dihapus |
| Fitur PDF & simulasi | Dicatat sebagai pekerjaan terpisah |

## 5. Rincian perubahan

### 5.1 Tujuh tombol

| Lokasi | Tombol | Tindakan |
|---|---|---|
| `page.tsx` ~L380, ~L501 | "Download Matriks PDF" (header + kartu aksi) | **Hapus** |
| `page.tsx` ~L785 | Ikon "Buka detail kuadran lengkap" | **Hapus** |
| `page.tsx` ~L1016, ~L1053, ~L1090 | "Opsi Tata Kelola …" (3 tombol aksi di tabel suksesi) | **Hapus** |
| `page.tsx` ~L407, ~L485, ~L923 | "Simulasi Talent Pool Suksesi" | **Ganti nama** menjadi "Muat ulang data" — karena itulah yang benar-benar dilakukannya (fetch ulang ringkasan), bukan simulasi |

Tombol "Muat ulang data" memakai `handleRunAi` yang sudah ada; hanya namanya yang
berubah, perilaku tidak. Pesan suksesnya juga disesuaikan agar menyebut data dimuat
ulang, bukan "simulasi".

### 5.2 Persentase per kotak

`populationPct` (string hardcoded) dihapus dari tipe dan kesembilan data kotak.
Persentase dihitung saat render:

```
persen(kodeKotak) = summary ? round(jumlah(kotak) / summary.total * 100, 1) : null
```

- Bila `summary` belum ada → tampilkan **"—"** (bukan 0%, karena 0 berarti "tidak ada
  orang", beda arti dari "belum dimuat").
- Bila `summary.total === 0` → tampilkan **"—"** (hindari pembagian nol).
- Label "Top 3.4%" pada kotak 9 dihapus; semua kotak memakai format yang sama (`x,x%`)
  agar tidak ada kotak yang terlihat istimewa tanpa alasan data.

## 6. Batasan

- Bahasa Indonesia, tanpa jargon (selaras dengan pekerjaan sebelumnya).
- Tidak boleh ada teks rusak/mojibake (sudah ada tes regresinya).
- Penghapusan tombol tidak boleh menyisakan markup/tombol kosong.

## 7. Pekerjaan lanjutan yang dicatat (tidak dikerjakan di sini)

1. **Laporan PDF 9-Box** — perlu desain isi laporan (periode, cakupan, tanda tangan).
2. **Simulasi talent pool** — perlu definisi bisnis: masukan apa, aturan apa,
   keluaran apa. Tanpa itu, fitur hanya akan jadi angka karangan lagi.
3. **Aksi tata kelola suksesi** (wawancara KRN, rotasi, akselerasi mentoring) — tombol
   dihapus di sini; bila diinginkan, perlu alur kerja nyata dengan audit trail.

## 8. Yang diserahkan ke pelaksana

- Susunan markup setelah tombol dihapus (jarak/spasi tabel) agar tidak ada ruang kosong.
- Nama berkas tes dan bentuk stub.
