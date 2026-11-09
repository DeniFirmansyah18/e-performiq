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
| `calculateAndSaveGPA` | Melempar `ForbiddenError` untuk peran tanpa `appraisal:calibrate`, sebelum menyentuh DB. |
| `calibrateAppraisal` | Menegakkan `resolveVisibleEmployeeIds` + `assertEmployeeVisible` setelah pengecekan 409. |
| UI 9-Box | Menampilkan `role="alert"` berisi `detail` dari server; pesan sukses menyebut **terkunci** vs **BELUM terkunci** sesuai `is_calibrated`. |

## 5. Yang diperiksa dan ternyata bukan masalah

Dugaan awal: GUC `eperformiq.allow_appraisal_update` yang dipakai
`setAppraisalCalibrated` bisa bocor ke request lain pada koneksi bersama dan
mematikan trigger `trg_appraisal_immutable`.

**Hasil probe:** tidak bocor. Update biasa terhadap baris terkunci tetap ditolak
trigger, dan `current_setting` kembali `off` setelah blok `finally`. Pertahanan
DB berfungsi; masalahnya murni di lapisan otorisasi aplikasi.

## 6. Konsekuensi yang diterima

`PEOPLE_MANAGER` kini **tidak dapat menyimpan hasil kalkulasi penilaian sama
sekali** (403). Ini konsekuensi langsung dari keputusan menjaga izin tetap.
Lihat butir follow-up di README.

## 7. Pekerjaan lanjutan

1. **Alur kalibrasi dua tahap**: manajer menyimpan usulan (`is_calibrated`
   tetap `false`), HR/BOD mengesahkan. Butuh kolom/status baru dan UI.
2. **Tombol "Download Matriks PDF"** dan **"Simulasi Talent Pool"** di halaman
   yang sama masih memanggil `alert()`.
3. **Istilah & alur 9-Box**: penerjemahan istilah ke Bahasa Indonesia dan
   perbaikan label sumbu (desain disetujui di percakapan, belum diimplementasikan).
