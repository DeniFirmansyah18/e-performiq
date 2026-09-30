# ADR 004: Imutabilitas Audit & Penegakan Scope Akses

Tanggal: 2026-09-28
Status: Diterima

## Konteks

Dua jaminan keamanan Govera360 perlu dikunci dengan tes otomatis:

1. **Imutabilitas audit** (PRD 6.2): `audit_logs` tidak boleh diubah atau
   dihapus siapa pun, ditegakkan oleh trigger
   `trg_audit_logs_immutable` pada `0001_init.sql`.
2. **Scope akses karyawan**: `assertEmployeeVisible`
   (`src/lib/auth/scope.ts`) menolak akses ke `employee_id` di luar cakupan
   sesi dengan `ForbiddenError` (status 403), yang dipetakan `problem()`
   menjadi respons RFC 7807.

Klarifikasi peran: `HR_MANAGER` termasuk `ORG_WIDE_ROLES` (spesifikasi
§6.3) sehingga cakupannya adalah seluruh organisasi — "di luar scope"
tidak terdefinisi untuk peran ini. Tes lintas-scope memakai
`PEOPLE_MANAGER`, yang cakupannya benar-benar terbatas (diri sendiri +
bawahan hingga kedalaman 5 via CTE rekursif).

## Keputusan

1. Tes `tests/integration/audit-mutation.test.ts`: `UPDATE` dan `DELETE`
   pada `audit_logs` harus melempar error `immutable`, dan baris data
   terbukti tidak berubah.
2. Tes `tests/api/cross-scope-access.test.ts`: `PEOPLE_MANAGER` boleh
   membaca KPI bawahan langsungnya, ditolak `ForbiddenError` (403) untuk
   karyawan di luar scope, dan `problem()` memetakan penolakan tersebut
   menjadi HTTP 403.
3. **Tidak ada perubahan kode produksi.** Verifikasi menunjukkan
   `assertEmployeeVisible` sudah melempar `ForbiddenError` yang benar dan
   trigger audit sudah ada — tes ini mengunci perilaku tersebut agar
   regresi di masa depan tertangkap.

## Konsekuensi

- Setiap perubahan pada `scope.ts`, `errors.ts`, atau trigger audit yang
  melemahkan jaminan akan menggagalkan CI.
- Penambahan peran baru ke `ORG_WIDE_ROLES` harus disertai pembaruan
  tes ini bila peran tersebut seharusnya memiliki scope terbatas.
