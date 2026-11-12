# Pencegahan & Pemulihan Kerusakan Database (PGlite)

## Gejala

Saat membuka aplikasi (mis. role HR), muncul:

```
Gagal memuat analitik kepegawaian: Aborted(). Build with -sASSERTIONS for more info.
Terjadi kesalahan internal pada server. Silakan coba kembali.
```

Login pun ikut gagal (HTTP 500) karena **seluruh** query database gagal.

## Penyebab

PGlite menulis langsung ke berkas data di `.pglite/`. Bila proses yang
memegangnya berhenti **tanpa sempat menutup berkas** — mis. dimatikan paksa
(`Stop-Process -Force`, `taskkill /F`, `kill -9`), atau dihentikan saat
penulisan sedang berlangsung — berkasnya menjadi rusak. Setelah itu setiap
query gagal dengan `Aborted()`.

## Pencegahan yang sudah terpasang

| Lapisan | Berkas | Fungsi |
|---|---|---|
| Penutupan rapi di aplikasi | `src/lib/db/client.ts` | Menutup PGlite pada `SIGINT`, `SIGTERM`, `exit`, dan `beforeExit`. Penangan dipasang **sebelum** berkas dibuka, dan semua instance client didaftarkan agar ikut ditutup meski modul dimuat ulang oleh `next dev`. |
| Berhenti aman | `scripts/stop-dev.ps1` (`npm run dev:stop`) | Meminta proses berhenti dengan sopan, menunggu, lalu memeriksa kesehatan database. |
| Pemeriksaan cepat | `scripts/cek-sehat.ts` (`npm run db:check`) | Melaporkan `SEHAT` atau `RUSAK`. |
| Pemulihan | `scripts/pulihkan-db.ts` (`npm run db:recover`) | Memindahkan direktori rusak (tidak dihapus), membangun ulang lewat migrasi + seed, lalu memverifikasi. |
| Isolasi tes | `vitest.config.ts` | Tes memakai `.pglite-test`, terpisah dari database dev. |

## Cara memakai

Hentikan server dengan:

```bash
npm run dev:stop
```

Jangan memakai `Stop-Process -Force`, `taskkill /F`, atau menutup terminal yang
mematikan proses tanpa penutupan (mis. menutup jendela proses secara paksa).

Periksa kesehatan database kapan saja:

```bash
npm run db:check
```

Bila hasilnya `RUSAK`, pulihkan:

```bash
npm run db:recover
```

Data lama **tidak dihapus**: direktori rusak dipindahkan ke
`.pglite-rusak-<waktu>` sehingga masih bisa diperiksa.

## Bukti pengujian

| Skenario | Hasil |
|---|---|
| `SIGTERM` saat server aktif melayani request DB | DB **SEHAT** |
| `SIGTERM` saat 80 request berjalan bersamaan | DB **SEHAT** |
| `kill -9` (pemutusan paksa) setelah DB diakses | DB **SEHAT** |
| `npm run dev:stop` | DB **SEHAT**, status diperiksa otomatis |

## Catatan

- Kerusakan **tidak mungkin dihindari sepenuhnya** bila proses dibunuh tepat
  saat PGlite menulis. Karena itu `db:recover` tetap disediakan.
- Untuk produksi, gunakan PostgreSQL server melalui `DATABASE_URL`; masalah ini
  hanya berlaku pada PGlite (penyimpanan berbasis berkas).
