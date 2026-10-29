# ADR 023 — Register Penawaran Kerja: Surat, Batas Waktu, Audit, dan Gaji pada Konversi

**Status:** Diterima
**Tanggal:** 2026-10-29
**Konteks terkait:** ADR 022 (integritas transisi offer), ADR 010 (public careers), modul e-Surat (ADR 0050), PRD Pra-Bekerja

## Konteks

ADR 022 menghilangkan cacat integritas: status `HIRED` kini atomik dan penawaran yang ditolak melepas kuota. Namun tiga celah alur OFFERED masih tersisa:

1. **Tidak ada jejak penawaran.** Selama ini `OFFERED` hanya status: siapa menawarkan, berapa gaji, dan sampai kapan kandidat harus merespons tidak tercatat. Tidak ada audit trail penawaran, tidak ada batas waktu untuk menindaklanjuti.
2. **`employee_code` acak.** Konversi menghasilkan `EMP-M1ABCD-XXXX` yang tidak bisa diurutkan per tahun masuk dan sulit dicari/dilaporkan.
3. **`base_salary = 0` saat konversi.** Karyawan baru masuk payroll dengan gaji 0; slip gaji tidak sah sampai HR mengisi manual.

## Keputusan

### 1. Tabel `job_offers` sebagai sumber kebenaran penawaran

- `job_offers` (migrasi `0059`): satu baris per lamaran (`UNIQUE application_id`).
  - `base_salary`, `fixed_allowance`, `offered_by`, `offered_at`, `response_deadline`, `responded_at`, `response_note`.
  - Status `offer_status_enum`: `SENT | ACCEPTED | DECLINED | EXPIRED | CANCELLED`.
  - `letter_agenda_number` menautkan baris ke surat di modul e-Surat.
- Tidak menambah nilai `application_status_enum` baru (sudah ada `OFFER_DECLINED` di ADR 022): status lamaran tetap turunan status penawaran.

### 2. Surat penawaran terdaftar di e-Surat

- `extendOffer` menulis `letters` arah `OUTGOING`, klasifikasi `BIASA`, subjek `Penawaran Kerja — {posisi} — {nama}`, agenda unik `OFFER-YYYYMMDD-XXXX`.
- Saat respons (`respondToOffer`) dicatat, surat di-`CLOSED`.
- Surat dihasilkan di modul letters yang sudah ada, bukan sistem surat kedua.

### 3. Batas waktu respons dan audit trail

- `response_days` 1–60 hari (default 7); divalidasi pada penerbitan.
- `expireOverdueOffers` menandai `SENT` melewati deadline menjadi `EXPIRED`; `listExpiringOffers` mengembalikan penawaran SENT/EXPIRED dalam 3 hari untuk tindak lanjut HR.
- Audit trail memakai `audit_logs` (entity `job_offers`, record_id = application id): `CREATE` = penawaran diterbitkan (dengan aktor HR), `UPDATE` = respons (dengan keterangan respons).
- `record_id` memakai PK `applicationId` sebagai text (bukan cast ke uuid), karena kolom `audit_logs.record_id` bertipe text.

### 4. Konversi HIRED membutuhkan penawaran bergaji

- `convertHiredCandidate` menolak konversi tanpa `job_offers` dengan `base_salary > 0` (BusinessRuleError 422), sehingga tidak ada lagi karyawan dengan gaji 0.
- `employee_code` dihasilkan deterministik `EMP-TAHUN-NNNN`, nomor urut dihitung dari maksimum urutan tahun berjalan pada query SQL (aman untuk konversi bersamaan).

## Konsekuensi

1. Alur bergeser: `extendOffer` → (kandidat respons) → `respondToOffer`/`PATCH status HIRED` → konversi. Konversi tanpa penawaran kini gagal eksplisit, bukan diam-diam gaji 0.
2. `recordDecision('ACCEPTED')` tetap hanya mengirim penawaran (status OFFERED); konversi tetap dipicu oleh HIRED (via `updateApplicationStatus` atau `respondToOffer('ACCEPTED')`).
3. Statistik seleksi bersih: `REJECTED` = tidak lolos, `OFFER_DECLINED` = lolos tetapi menolak, `EXPIRED` = tidak merespons.
4. Keputusan gaji berada pada penerbitan penawaran, bukan pada konversi.

## Alternatif yang ditolak

| Alternatif | Alasan ditolak |
|---|---|
| Surat sebagai field text di `job_offers` | Memisahkan surat dari tata kelola surat (agenda, disposisi, status) yang sudah ada |
| `employee_code` via `randomCode` | Tidak bisa diurutkan per tahun masuk; pencarian/pelaporan payroll susah |
| Gaji 0 + field "belum diisi" | Memperpanjang keadaan tidak sah (slip gaji 0) ke produksi |
| Memakai `letters` satu arah untuk semua penawaran tanpa `job_offers` | Tidak ada batas waktu respons dan status penawaran yang memisahkan kedaluwarsa dari penolakan |