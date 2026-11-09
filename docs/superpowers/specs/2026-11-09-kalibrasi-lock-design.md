# Spec — Kalibrasi 9-Box: tombol tidak boleh berbohong

**Tanggal:** 2026-11-09
**Status:** Selesai diimplementasikan (`fix/kalibrasi-lock`)
**Rencana:** `docs/superpowers/plans/2026-11-09-kalibrasi-lock.md`

## 1. Masalah

Tombol **"Sahkan Kalibrasi & Simpan"** pada `/dashboard/ninebox-matrix` mengirim
`POST /api/v1/performance/appraisals/calculate-gpa`. Endpoint itu hanya mengunci
nilai (`is_calibrated = TRUE`) bila pemanggil memegang `appraisal:calibrate`
(`SUPER_ADMIN`, `HR_MANAGER`, `BOD`). Untuk peran lain — terutama
`PEOPLE_MANAGER`, peran yang justru paling dekat dengan anggota timnya —
endpoint tersebut **tetap menyimpan nilai** dan mengembalikan HTTP 200.

Akibatnya:

1. UI menampilkan pesan "berhasil disahkan" padahal tidak ada yang disahkan.
2. Nilai karyawan benar-benar berubah tanpa terkunci (terbukti di tes: GPA
   bergeser dari 3.55 ke 0.40).
3. Endpoint kalibrasi yang sah — `PUT /api/v1/performance/appraisals/:id/calibrate`
   — tidak pernah dipanggil UI.

## 2. Tujuan dan non-tujuan

**Tujuan:** tombol berhenti berbohong. Bila server menolak, UI mengatakan
ditolak. Bila berhasil, UI menyatakan status kunci yang sebenarnya.

**Non-tujuan:** merancang ulang alur otorisasi. Ini perbaikan korektif, bukan
redesain.

## 3. Keputusan pemilik produk

- **Izin `appraisal:calibrate` tidak diubah** — tetap `SUPER_ADMIN`, `HR_MANAGER`,
  `BOD`. `PEOPLE_MANAGER` **tidak** ditambahkan.
- **Alur dua tahap** (manajer mengusulkan → HR/BOD mengesahkan) dicatat sebagai
  pekerjaan terpisah, bukan dikerjakan sekarang.
- Endpoint `PUT /calibrate` tidak ditambahkan ke UI: `calculate-gpa` sudah
  mengunci otomatis bagi pemegang izin, sehingga rangkaian keduanya selalu
  berakhir 409.

## 4. Perubahan yang diterapkan

| Area | Perubahan |
|---|---|
| `calculateAndSaveGPA` | Parameter `approve` (default `true`). `approve: true` butuh `appraisal:calibrate` (else 403) dan **menolak baris yang sudah terkunci** (409). `approve: false` menyimpan tanpa mengunci. |
| `calculateAndSaveGPA` | Baris `is_calibrated = TRUE` tidak dapat ditimpa oleh siapa pun (409) — satu-satunya jalan adalah `unlock_appraisal()`. |
| `calibrateAppraisal` | Menegakkan `resolveVisibleEmployeeIds` + `assertEmployeeVisible` setelah pengecekan 409. |
| UI 9-Box | Menampilkan `role="alert"` berisi `detail` dari server — di dalam modal **dan** di halaman; pesan sukses menyebut **terkunci** vs **BELUM terkunci**. |
| UI Manager Cockpit | Mengirim `approve: false` sehingga alur evaluasi kinerja manajer tetap berfungsi. |

## 4a. Kesalahan yang ditemukan review dan diperbaiki

Versi pertama perubahan ini menolak **semua** penyimpanan oleh peran tanpa
`appraisal:calibrate`. Review menemukan akibat yang tidak diperhitungkan:
`manager-cockpit` — dashboard milik `PEOPLE_MANAGER` — memakai endpoint yang
sama untuk tombol **"Hitung & Simpan Nilai ke PostgreSQL"**, dan seluruh alur
evaluasi kinerja manajer langsung mati (403). Perbaikan: penyimpanan dan
pengesahan dipisah lewat parameter `approve`.

Review juga menemukan bahwa `calculate-gpa` **menimpa baris yang sudah
terkunci** bila pemanggil adalah kalibrator (dibuktikan: GPA 3.67 → 2.00 tanpa
error), karena form 9-Box default menunjuk karyawan yang appraisal-nya sudah
dikunci di seed. Kini dijaga 409.

## 5. Yang diperiksa dan ternyata bukan masalah

Dugaan awal: GUC `eperformiq.allow_appraisal_update` yang dipakai
`setAppraisalCalibrated` bisa bocor ke request lain pada koneksi bersama dan
mematikan trigger `trg_appraisal_immutable`.

**Hasil probe:** tidak bocor. Update biasa terhadap baris terkunci tetap ditolak
trigger, dan `current_setting` kembali `off` setelah blok `finally`. Pertahanan
DB berfungsi; masalahnya murni di lapisan otorisasi aplikasi.

## 6. Konsekuensi yang diterima

`PEOPLE_MANAGER` dapat menyimpan hasil evaluasi tetapi **tidak dapat
mengesahkan**. Nilai yang ia simpan berstatus belum terkunci, sehingga
memang belum ada jalur persetujuan eksplisit baginya — itu isi pekerjaan
lanjutan nomor 1 di bawah.

## 7. Pekerjaan lanjutan

1. **Alur kalibrasi dua tahap**: manajer menyimpan usulan (`is_calibrated`
   tetap `false`), HR/BOD mengesahkan. Butuh kolom/status baru dan UI.
2. **Tombol "Download Matriks PDF"** dan **"Simulasi Talent Pool"** di halaman
   yang sama masih memanggil `alert()`.
3. **Istilah & alur 9-Box**: penerjemahan istilah ke Bahasa Indonesia dan
   perbaikan label sumbu (desain disetujui di percakapan, belum diimplementasikan).
