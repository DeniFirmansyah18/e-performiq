# ADR 022 — Integritas Transisi Offer: Konversi Atomik, Status OFFER_DECLINED, dan Pengembalian Kuota

**Status:** Diterima
**Tanggal:** 2026-10-29
**Konteks terkait:** ADR 010 (public careers & candidate intake), ADR 004 (immutability & scope), PRD Pra-Bekerja (MPP → rekrutmen → onboarding)

## Konteks

Status lamaran `OFFERED` berarti **penawaran dikirim**, bukan kandidat sudah menjadi karyawan. Konversi kandidat→karyawan (`employees` + `users` + onboarding + KPI pembuka) baru terjadi saat status dinaikkan ke `HIRED`. Audit alur tersebut menemukan tiga cacat integritas:

1. **Status `HIRED` di-set lebih dulu, konversi menyusul dalam `try/catch` yang hanya `console.warn`.** Bila konversi gagal (mis. email kandidat sudah dipakai karyawan lain), lamaran tetap tercatat `HIRED` dan kandidat menerima notifikasi DITERIMA, tetapi tidak memiliki record `employees`/`users` — kandidat tidak dapat login, dan data kepegawaian tidak pernah ada.
2. **Kuota MPP terpakai saat `OFFERED` dan tidak pernah dikembalikan.** `approveApplication` (jalur internal) menaikkan `manpower_plans.hired_count`, tetapi bila kandidat menolak tawaran tidak ada jalur penurunan. Formasi tampak terisi, rekrutmen berikutnya terblokir.
3. **Tidak ada status "menolak penawaran".** Kandidat yang menolak harus di-`REJECTED`, sehingga statistik seleksi mencampur "tidak lolos" dengan "lolos tetapi memilih tidak bergabung".

## Keputusan

### 1. Transisi status + konversi dalam satu transaksi

`updateApplicationStatus` (`candidateService`) menjalankan `UPDATE job_applications` dan konversi karyawan di dalam **satu transaksi**. Kegagalan konversi membatalkan keduanya dan melempar `BusinessRuleError` (HTTP 422) dengan pesan yang dapat ditindaklanjuti HR.

- Pengayaan yang bergantung layanan luar (penyusunan kurikulum onboarding via AI) dijalankan **setelah commit** dan tetap best-effort: kegagalannya tidak boleh membatalkan kepegawaian yang sudah sah, dan dapat diulang karena idempoten.
- Objek transaksi dibungkus `withNormalizedExecute` karena `tx` tidak mewarisi normalisasi `{ rows }` milik `db`; tanpa itu seluruh query dalam transaksi kehilangan bentuk `{ rows }` pada driver PostgreSQL (ADR 007).

### 2. Status `OFFER_DECLINED` untuk jalur publik

- Nilai baru pada `application_status_enum` (migrasi `0058`), dipetakan ke timeline `DECISION/FAILED`.
- Kuota lowongan **tidak perlu dikoreksi manual**: kuota publik dihitung dari status `HIRED`/`OFFERED`, sehingga `OFFER_DECLINED` otomatis melepas satu slot.
- Notifikasi kandidat memakai naskah tersendiri (bukan naskah penolakan seleksi).
- `REJECTED` kembali bermakna tunggal: kandidat tidak lolos seleksi.

### 3. Jalur internal memakai `WITHDRAWN` + pengembalian kuota

`internal_applications` sudah memiliki `WITHDRAWN`, jadi tidak perlu nilai enum baru (menghindari perubahan CHECK constraint). `declineInternalOffer` menurunkan `manpower_plans.hired_count` dalam transaksi yang sama dengan perubahan status, memakai `GREATEST(hired_count - 1, 0)` agar data lama yang tidak sinkron tidak menghasilkan angka negatif.

Penolakan hanya sah dari status `OFFERED`; penolakan ulang ditolak aturan bisnis sehingga kuota tidak kembali dua kali.

## Konsekuensi

1. HR tidak lagi dapat "menghasilkan" lamaran `HIRED` tanpa karyawan: kegagalan konversi terlihat sebagai galat, bukan sukses palsu.
2. Kuota MPP mengikuti kenyataan: tawaran yang ditolak mengembalikan slot pada kedua jalur.
3. Statistik seleksi menjadi bersih: `REJECTED` = tidak lolos; `OFFER_DECLINED` = lolos tetapi menolak.
4. Transaksi konversi memperpanjang durasi kunci baris lamaran; dapat diterima karena operasi dilakukan per kandidat oleh HR.

## Alternatif yang ditolak

| Alternatif | Alasan ditolak |
|---|---|
| Tetap best-effort + tombol "perbaiki konversi" manual | Membiarkan status HIRED tanpa karyawan sebagai keadaan normal; sulit diaudit |
| Menaikkan kuota saat `HIRED` saja | Mengubah titik pemakaian kuota yang sudah dipakai MPP/analitik; risiko over-hire selama penawaran berjalan |
| Menambah nilai pada CHECK `internal_applications.status` | Perubahan constraint lebih berisiko daripada memakai `WITHDRAWN` yang sudah bermakna sama |
| Memakai `REJECTED` untuk penolakan penawaran | Mencampur dua sebab berbeda dalam satu status; MRR/konversi funnel jadi salah |