# Desain: Profil Saya per Peran

**Tanggal:** 2026-11-10
**Status:** menunggu persetujuan

## Intent

"Profil Saya" saat ini identik untuk semua peran dan hanya menampilkan data
identitas dasar. HR Manager, People Manager, dan BOD adalah pegawai yang juga
punya jabatan, departemen, atasan penilai, bawahan, dan masa kerja — konteks
yang tidak ditampilkan. Hasilnya profil terasa "kosong" bagi peran struktural,
padahal datanya sudah ada di database.

Tujuan: profil pribadi setiap peran menampilkan konteks kepegawaian yang
relevan bagi dirinya, tanpa mengubah hak untuk menyunting data pribadi.

Ini **berbeda** dari "Kontrol Siklus 3-Fase" (mengelola orang lain) dan dari
Manager Cockpit / HR Command Center (dashboard kerja tim).

## Yang sudah ada

- `GET /api/v1/profile/me` → `getMyProfile` memilih kolom dari `employees`:
  `employeeCode, fullName, email, phoneNumber, status, baseSalary, joinDate,
  dateOfBirth, address, emergencyContactName, emergencyContactPhone,
  photoUrl, bio, gender, nik`.
- **Tidak dipilih**: `positionTitle`, `departmentName`, `managerName`, `managerCode`
  — padahal `getProfileLifecycle` sudah mengambilnya lewat JOIN.
- `PATCH /api/v1/profile/me` menerima `phone_number, address, date_of_birth,
  emergency_contact_name, emergency_contact_phone, photo_url, bio` (`.strict()`).
- `MyProfileModal` merender satu bentuk tetap untuk semua peran.

## Keputusan yang sudah diambil

1. **Hak suntingan sama untuk semua peran** (keputusan pemilik produk):
   HR, People Manager, dan BOD boleh menyunting data pribadinya seperti
   Employee. Kekhawatiran *self-approval* untuk HR diterima sebagai risiko
   yang disadari; tidak ada alur persetujuan tambahan pada lingkup ini.

2. **Lingkup = profil diri sendiri**, bukan ringkasan tim. Angka tim tetap
   ada di Manager Cockpit dan HR Command Center.

## Pendekatan yang dipertimbangkan

**A. Perluas API + bagian kontekstual di modal (dipilih)**
`getMyProfile` menambah JOIN ke `departments`, `job_positions`, `employees`
(atasan) dan menghitung bawahan langsung + masa kerja. `MyProfileModal`
menampilkan blok "Kepegawaian" untuk peran struktural.
*Trade-off:* satu query bertambah ringan; data pribadi tetap satu sumber.

**B. Sumber kedua `/profile/lifecycle`**
Modal memanggil dua endpoint.
*Trade-off:* tidak perlu ubah API profil, tetapi dua request, dua bentuk data,
dan dua tempat yang harus dijaga konsisten. Ditolak.

**C. Halaman profil terpisah per peran**
*Trade-off:* paling leluasa, tetapi duplikasi besar untuk kebutuhan yang
hanya "tambah beberapa field". Ditolak.

## Rancangan (A)

### Data

`getMyProfile` menambah kolom hasil JOIN:
- `positionTitle`, `departmentName` (via `job_positions`, `departments`)
- `managerName`, `managerCode` (self-join `employees.manager_id`)
- `directReportCount` (hitung `employees` dengan `manager_id = ?` dan status aktif)
- `tenureLabel` dihitung di UI dari `joinDate` (bukan query baru)

`baseSalary` **berhenti dikirim** ke klien. UI tidak pernah menampilkannya, dan
mengirim gaji pokok ke browser tanpa dipakai menambah risiko tanpa manfaat.

### Tampilan

Modal tetap satu, dengan blok yang tampil bersyarat:

| Blok | Employee | HR | People Manager | BOD |
|---|---|---|---|---|
| Identitas (NIP, nama, email, status, NIK, gender) | ✓ | ✓ | ✓ | ✓ |
| **Kepegawaian** (jabatan, departemen, tgl masuk, masa kerja) | ✓ | ✓ | ✓ | ✓ |
| **Dinilai oleh** (atasan) | ✓ | ✓ | ✓ | — |
| **Bawahan langsung** (jumlah) | — | ✓ | ✓ | ✓ |
| Data pribadi yang dapat disunting | ✓ | ✓ | ✓ | ✓ |

BOD tidak menampilkan "dinilai oleh": penilaian pimpinan dilakukan Dewan di
luar sistem, sehingga menampilkan atasan akan menyesatkan.

### Batasan

- Tidak mengubah RBAC atau middleware.
- Tidak menyentuh `Kontrol Siklus 3-Fase`, Manager Cockpit, atau HR Command Center.
- Bawahan dihitung dari `manager_id`; karyawan nonaktif tidak dihitung.
- Tidak ada fitur baru untuk menyunting jabatan/departemen dari profil
  (tetap wewenang HR lewat jalur kepegawaian).

## Non-goals

- Ringkasan kinerja/KPI tim di profil.
- Riwayat mutasi jabatan.
- Unggah dokumen dari profil.

## Anti-goals

- Menampilkan gaji pokok di browser.
- Menjadikan profil pintu masuk untuk mengubah data kepegawaian struktural.
- Membuat profil BOD menampilkan angka organisasi (itu tugas Boardroom).
