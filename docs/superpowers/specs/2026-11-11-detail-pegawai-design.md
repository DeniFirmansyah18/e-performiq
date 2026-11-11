# Desain: Halaman Detail Pegawai & Perbaikan Panel Fase

Tanggal: 2026-11-11
Status: disetujui

## Niat dan alasan

HRD perlu melihat seluruh data seorang pegawai dalam satu tempat. Sekarang
detail hanya tersedia sebagai modal sempit di Direktori Pegawai yang memuat
beberapa field saja (kode, status, departemen, grade, GPA, rating). Payroll,
KPI, indikator, dan kehadiran tidak terlihat sama sekali.

Selain itu, pada "Kontrol Siklus 3-Fase" kartu fitur membuka panel di area
terpisah jauh di bawah, sehingga pengguna kehilangan konteks.

## Tujuan

- Halaman penuh `/dashboard/employees/[id]` berisi profil, penggajian, kinerja,
  indikator, kehadiran, dan data lain per pegawai.
- Akses berjenjang:
  - SUPER_ADMIN / BOD / HR_MANAGER: semua pegawai.
  - PEOPLE_MANAGER: hanya bawahan langsung (dan dirinya sendiri).
  - EMPLOYEE: hanya dirinya sendiri.
- Bagian penggajian hanya tampil bila pemilik izin `payroll:read`
  (SUPER_ADMIN, BOD, HR_MANAGER).
- Panel fitur pada fase terbuka tepat di bawah kartu yang diklik.

## Bukan tujuan

- Tidak mengubah izin payroll yang sudah ada.
- Tidak memindahkan atau menghapus Direktori Pegawai; tombol detailnya cukup
  diarahkan ke halaman baru.
- Tidak membuat fitur edit dari halaman ini (tetap lewat alur yang ada).

## Batasan

- `employees.department_id` dan `position_id` NOT NULL.
- `achievement_percentage` adalah kolom GENERATED (actual/target*100).
- Halaman detail harus mengirim data gaji HANYA bila sesi berhak, bukan
  menyembunyikannya di sisi klien.

## Pendekatan yang dipertimbangkan

1. **Perluas modal yang ada.** Cepat, tetapi modal sempit untuk payroll dan
   KPI; pengguna harus menggulir panjang di area kecil. Ditolak.
2. **Halaman tersendiri dengan tab.** Dipilih. Ruang luas, tiap kelompok data
   punya tab, dan URL dapat dibagikan.
3. **Banyak halaman terpisah per topik.** Terlalu berpecah untuk kebutuhan
   "melihat lengkap dalam satu tempat". Ditolak.

## Rancangan

### Rute dan otorisasi

`src/app/dashboard/employees/[id]/page.tsx` — komponen klien yang memanggil
`GET /api/v1/hr/employees/[id]/detail`.

Aturan akses dipusatkan pada satu fungsi `bolehLihatPegawai(session, targetId)`
di lapisan server:

- SUPER_ADMIN / BOD / HR_MANAGER: boleh.
- PEOPLE_MANAGER: boleh bila `targetId === session.employeeId` atau atasan
  langsung target adalah diri sendiri.
- EMPLOYEE: hanya bila `targetId === session.employeeId`.
- Selain itu: 403.

### Bentuk respons

```ts
{
  profil: { id, employeeCode, fullName, email, phone, departmentName,
            positionTitle, jobGrade, status, joinDate, masaKerja,
            managerName, directReportCount, employmentType },
  penggajian?: { gajiPokok, tunjangan[], potongan[], slipPeriode[] },
  kinerja: { kpiAktif[], riwayatPenilaian[], gpaTerakhir, ratingTerakhir },
  indikator: { kpiHarian[], targetHarian },
  kehadiran: { ringkasanBulanIni, absensiTerbaru[], lembur[], cuti[] },
  lainnya: { bpjs, dokumen[], faseKepegawaian }
}
```

`penggajian` tidak dikirim sama sekali (bukan objek kosong) bila sesi tidak
punya `payroll:read`.

### Tata letak halaman

- Header: nama, NIP, jabatan, departemen, status, tombol kembali ke Direktori.
- Tab: Ringkasan · Penggajian · Kinerja · Indikator · Kehadiran · Lainnya.
- Tab Penggajian disembunyikan bila `penggajian` tidak ada.
- Tiap daftar memakai `DataTable` (sudah dipakai di tempat lain) agar
  konsisten: 10 baris per halaman, pencarian, nomor halaman maksimal 5.

### Perbaikan panel fase

Pada `hr-command/page.tsx`, panel fitur fase dirender **di dalam** fase,
tepat setelah grid kartu yang memuat kartu terpilih — bukan di blok terpisah
di bawah halaman. Bila pengguna menutup panel, fokus kembali ke kartu.

## Yang diserahkan ke pelaksana

- Nama kolom tabel tiap tab.
- Susunan kartu ringkasan pada tab Ringkasan.
- Penanganan bila data suatu bagian kosong (tampilkan keterangan jujur,
  bukan angka nol palsu).
