# Spec — Executive Boardroom BOD (Revisi Narasi 4)

**Tanggal:** 2026-10-25
**Status:** Menunggu Review
**Klasifikasi:** Architectural (kapabilitas baru pada `/dashboard/executive`)
**Rujukan:** PRD `PRD_Sistem_Penilaian_Karyawan (PT).md` §6.2 (RBAC & klasifikasi data), §7 (UI/UX), UU Cipta Kerja No. 6/2023, PP No. 35/2021, ISO 30414

---

## 1. Latar Belakang & Tujuan

Sesuai arahan owner pada **Revisi Bentuk Narasi 4**, dashboard eksekutif (`/dashboard/executive`) dinaikkan dari sekadar penampil VMAI/BSC menjadi **Boardroom Cockpit** tempat BOD melihat, menganalisis, dan menilai:

1. Seluruh aktivitas yang dijalankan semua profil pegawai.
2. Kotak visi & misi berbentuk persentase pencapaian, dibantu analisis AI yang merangkum performa kinerja dan aktivitas.
3. Kesesuaian performa pegawai terhadap posisi yang diduduki, dalam kerangka Rencana Jangka Menengah/Panjang (RJMP/RJPP).
4. Rincian payroll seluruh pegawai beserta BPJS, lembur, dan biaya operasional lainnya.
5. Semua hasil dalam bentuk analisis, bukan angka mentah.

### Keputusan yang sudah disepakati

| Topik | Keputusan |
|---|---|
| Akses payroll/BPJS | BOD melihat agregat + rincian payroll; **nomor BPJS ter-masking** (sesuai PRD §6.2.4) |
| Sumber pencapaian RJMP | Roll-up `individual_kpis` per pilar; **tanpa tabel baru** |
| Waktu analisis AI | On-demand (tombol), hasil di-cache per periode |
| Cakupan aktivitas | INTERNAL + CONFIDENTIAL; **RESTRICTED dikecualikan** |
| Bentuk UI | 5 tab; konten VMAI/BSC dipindah ke tab pertama |
| Arsitektur | Satu layanan per kapabilitas, endpoint per tab |

### Non-tujuan (YAGNI)

- Tidak membangun editor RJPP multi-tahun (cukup roll-up target `corporate_kpis` yang ada).
- Tidak memberi BOD kemampuan *impersonate* atau login sebagai pegawai lain.
- Tidak membuka nomor BPJS penuh, rekening, atau data medis.
- Tidak mengubah `executive-summary`/`vmai-scorecard` yang dipakai halaman lain.

---

## 2. Arsitektur & Alur Data

### 2.1 Tata letak tab `/dashboard/executive`

| Tab | `mainTab` | Endpoint | Sumber data nyata |
|---|---|---|---|
| Ringkasan VMAI & BSC | `overview` | `/api/v1/analytics/vmai-scorecard`, `/api/v1/analytics/executive-summary` (sudah ada) | `strategic_pillars`, `individual_kpis`, `performance_appraisals` |
| Aktivitas Semua Profil | `activity` | `/api/v1/analytics/board-activity` *(baru)* | `activity_events`, `employees`, `users` |
| Visi-Misi & Analisis AI | `vision` | `/api/v1/analytics/vision-achievement` *(baru)*, `POST /api/v1/ai/board-analysis` *(baru)* | `company_vision_mission`, `strategic_pillars`, `corporate_kpis`, `individual_kpis` |
| Kesesuaian Posisi & RJMP | `position-fit` | `/api/v1/analytics/position-fit` *(baru)* | `position_kpi_templates`, `individual_kpis`, `job_positions`, `performance_appraisals` |
| Payroll, BPJS & Biaya | `cost` | `/api/v1/analytics/board-cost` *(baru)* | `payroll_runs`, `payroll_items`, `employee_social_security`, `overtime_requests`, `expense_claims` |

Deep-link `?tab=` didukung (pola sama dengan `hr-command`).

### 2.2 Prinsip alur data

1. **Satu tab → satu service → satu route.** Tidak ada route yang mengimpor service tab lain.
2. **Tidak ada angka cadangan.** Seluruh fallback hardcoded di `executive/page.tsx` (`?? 89.4`, `?? 92.4`, `?? 87.1`, `?? 94.8`, `?? 83.3`) dihapus. Bila API gagal, panel menampilkan pesan gagal.
3. **Agregasi di SQL**, bukan di JavaScript, agar tetap benar saat data bertambah.
4. **Setiap respons analitik menyertakan `sampleSize`** (jumlah baris dasar) agar persentase tidak ditafsirkan berlebihan pada data tipis.

### 2.3 Komponen baru

```
src/components/executive/
  BoardTabNav.tsx                 # navigasi 5 tab + deep-link
  BoardActivityPanel.tsx
  BoardVisionPanel.tsx            # kotak visi-misi + persentase + tombol AI
  BoardPositionFitPanel.tsx
  BoardCostPanel.tsx
  BoardAiInsight.tsx              # tombol on-demand, tampilkan cache/umur
```

---

## 3. Kapabilitas 1 — Aktivitas Semua Profil

**Service:** `boardActivityAnalyticsService.getBoardActivityAnalytics(db, options)`

**Keluaran:**
```ts
export interface BoardActivityAnalytics {
  sampleSize: number;                     // jumlah event dalam rentang
  fromDate: string; toDate: string;
  totalEvents: number;
  byEventType: Array<{ eventType: string; count: number; percentage: number }>;
  byDepartment: Array<{ departmentName: string; count: number }>;
  byOwnerRole: Array<{ role: string; count: number; percentage: number }>;
  dailyTrend: Array<{ date: string; count: number }>;   // 14 hari terakhir
  recent: Array<{
    id: string; employeeName: string; employeeCode: string;
    departmentName: string; eventType: string; summary: string;
    occurredAt: string;
  }>;
  analysis: {
    busiestDepartment: string | null;
    busiestEventType: string | null;
    coveragePercentage: number;           // pegawai aktif yang punya ≥1 event
    activeEmployees: number;
    highlights: string[];                 // kalimat temuan terhitung
  };
}
```

**Aturan:**
- Klausa SQL: `WHERE a.visibility <> 'RESTRICTED'` — dikecualikan di query, bukan di UI.
- "Semua profil" = rincian `byOwnerRole` berdasarkan `users.role` pemilik aktivitas (BOD/HR_MANAGER/PEOPLE_MANAGER/EMPLOYEE/AUDITOR/SUPER_ADMIN/ASSESSOR). Pegawai tanpa akun pengguna dikelompokkan sebagai `NO_ACCOUNT` agar totalnya tetap utuh. BOD **tidak** dapat bertindak sebagai pegawai lain.
- Filter opsional: `eventType`, `departmentId`, `fromDate`, `toDate`, `search` (nama/NIK/ringkasan).
- Tanpa data: semua hitungan `0`, `analysis.highlights` berisi "Belum ada aktivitas pada rentang ini."

---

## 4. Kapabilitas 2 — Visi-Misi, Persentase, dan Analisis AI

**Service:** `boardVisionAchievementService.getVisionAchievement(db, periodCode?)`

**Keluaran:**
```ts
export interface VisionAchievement {
  vision: string | null;
  missions: string[];
  sampleSize: number;                      // jumlah individual_kpis terpakai
  overallAchievementPercentage: number;    // rata-rata tertimbang seluruh pilar
  measuredAchievementPercentage: number;   // capaian pada pilar yang terukur (konteks)
  measurementCoveragePercentage: number;   // % bobot yang punya KPI
  measuredWeight: number;                  // bobot terukur (mis. 75)
  totalWeight: number;                     // total bobot pilar aktif (mis. 100)
  pillars: Array<{
    pillarId: string; pillarName: string; perspective: string;
    strategicWeight: number;               // bobot pilar (%)
    kpiCount: number;
    achievementPercentage: number;         // tertimbang bobot KPI
    status: 'ACHIEVED' | 'BELOW_TARGET' | 'NO_DATA';
    measured: boolean;                     // false = belum dinilai (bukan gagal)
  }>;
  rjmp: Array<{
    corporateKpiId: string; kpiCode: string; kpiName: string;
    periodYear: number; targetValue: number; unit: string;
    derivedAchievementPercentage: number;  // roll-up pilar terkait
    status: 'ACHIEVED' | 'BELOW_TARGET' | 'NO_DATA';
  }>;
  analysis: {
    achievedPillarCount: number;
    belowTargetPillarCount: number;
    noDataPillarCount: number;
    weakestPillar: string | null;
    strongestPillar: string | null;
    highlights: string[];
  };
}
```

**Aturan perhitungan:**
- Capaian pilar = `SUM(achievement_percentage * kpi_weight) / SUM(kpi_weight)`. Bila `SUM(kpi_weight) = 0` → `achievementPercentage = 0` dan `status = 'NO_DATA'` (**tidak boleh** membagi nol).
- Capaian keseluruhan = rata-rata tertimbang **seluruh** pilar; pilar `NO_DATA` bernilai 0% pada bobotnya sendiri dan **tidak** dikeluarkan dari penyebut. Normalisasi ulang dilarang karena membuat skor naik hanya dengan tidak menyusun KPI (kelalaian administratif berubah menjadi perbaikan kinerja) dan mengubah basis perhitungan yang dipakai menilai Direksi.
- **Satu angka tidak boleh memikul dua arti.** Karena itu `measurementCoveragePercentage`, `measuredWeight`, dan `measuredAchievementPercentage` dilaporkan terpisah: "capaian" menjawab *seberapa baik kinerja*, "cakupan" menjawab *seberapa besar strategi yang terukur*. Kolom `measured` pada pilar membedakan *belum dinilai* dari *di bawah target*. Ini juga memenuhi tuntutan disclosure cakupan data ISO 30414.
- Narasi AI wajib menerima `measurementCoverage` agar pilar belum dinilai tidak dinarasikan sebagai kegagalan (lubang cascade ≠ kinerja buruk).
- Status: `ACHIEVED` bila ≥ 100, `BELOW_TARGET` bila < 100 dan ada data, `NO_DATA` bila pilar tanpa KPI.
- Capaian RJMP diturunkan dari pilar terkait (bukan angka baru), dan diberi label "diturunkan dari roll-up pilar" agar jelas asalnya.
- Visi/misi dibaca dari `company_vision_mission` terbaru. Misi dipecah dengan pemisah `|` atau baris baru (pola yang sudah dipakai `getCascadingTree`). Bila kosong → `null`/array kosong, dan UI menyatakan belum ditetapkan (bukan teks karangan).

### 4.1 Analisis AI

**Endpoint:** `POST /api/v1/ai/board-analysis`
**Body:** `{ periodCode?: string, force?: boolean }`

- Izin: `ai:read` (sudah mencakup BOD).
- Konteks dirakit dari `buildFeatureContext('executive')` yang **diperluas** dengan: pilar + capaian, RJMP turunan, ringkasan kesesuaian posisi, dan agregat aktivitas.
- **Dilarang** menyertakan gaji, komponen payroll, nomor BPJS, atau data RESTRICTED apa pun ke prompt. Dijaga oleh allowlist kunci, bukan denylist.
- **Cache:** tabel baru `ai_insights` (`feature`, `period_code`, `role`, `insight`, `provider`, `generated_at`, `payload_hash`), unik pada (`feature`, `period_code`, `role`).
  - Tanpa `force`: kembalikan cache bila `generated_at` masih dalam periode yang sama.
  - `force: true`: regenerasi dan perbarui baris.
- Bila AI tidak terkonfigurasi: `{ configured: false, insight: '<pesan ramah>' }` dengan HTTP 200 — bukan 500.
- Setiap generasi dicatat ke `audit_logs`: `CREATE` saat baris cache baru dibuat, `UPDATE` saat regenerasi, entitas `ai_insights`. Ini memakai `action_type` yang sudah diizinkan CHECK constraint sehingga tidak perlu mengubah skema audit.
- `payload_hash` = SHA-256 dari `JSON.stringify` konteks dengan kunci terurut stabil. Dipakai untuk mendeteksi bahwa data berubah meski periode sama.

---

## 5. Kapabilitas 3 — Kesesuaian Posisi & RJMP

**Service:** `boardPositionFitService.getPositionFit(db, periodCode?)`

**Keluaran:**
```ts
export interface PositionFit {
  sampleSize: number;                        // jumlah pegawai dievaluasi
  byPosition: Array<{
    positionId: string; positionTitle: string; jobGrade: string | null;
    holders: number;
    templateKpiCount: number;
    matchedKpiCount: number;
    coveragePercentage: number;              // bobot KPI cocok / total bobot template
    achievementPercentage: number;           // capaian tertimbang KPI yang cocok
    status: 'COMPLIANT' | 'PARTIAL' | 'NOT_COMPLIANT' | 'NO_TEMPLATE';
  }>;
  employees: Array<{
    employeeId: string; fullName: string; employeeCode: string;
    positionTitle: string; departmentName: string;
    templateKpiCount: number; matchedKpiCount: number;
    coveragePercentage: number; achievementPercentage: number;
    latestGpa: number | null; latestRating: string | null;
    status: 'COMPLIANT' | 'PARTIAL' | 'NOT_COMPLIANT' | 'NO_TEMPLATE';
  }>;
  analysis: {
    compliantPositions: number;
    positionsWithoutTemplate: number;
    averageCoveragePercentage: number;
    highlights: string[];
  };
}
```

**Aturan:**
- Kecocokan KPI: `LOWER(TRIM(kpi_title))` antara `position_kpi_templates` dan `individual_kpis` milik pegawai pada periode terkait.
- Status: `NO_TEMPLATE` bila posisi belum punya template (tidak dianggap gagal); `COMPLIANT` bila coverage ≥ 80 **dan** capaian ≥ 100; `PARTIAL` bila coverage ≥ 50; selain itu `NOT_COMPLIANT`.
- KPI yang tidak cocok dilaporkan sebagai `matchedKpiCount < templateKpiCount` dengan keterangan eksplisit "KPI tidak cocok dengan template", bukan ditebak.
- Pembagian nol: template kosong → `coveragePercentage = 0` + status `NO_TEMPLATE`.

---

## 6. Kapabilitas 4 — Payroll, BPJS, Lembur, Operasional

**Service:** `boardCostService.getBoardCostOverview(db, options)`

**Keluaran:**
```ts
export interface BoardCostOverview {
  sampleSize: number;                      // jumlah pegawai pada run terbaru
  payroll: {
    runs: Array<{
      runId: string; periodCode: string; status: string;
      totalGross: number; totalDeductions: number; totalNet: number;
      employeeCount: number; approvedAt: string | null;
    }>;
    latest: { periodCode: string; totalGross: number; totalNet: number } | null;
    trend: Array<{ periodCode: string; totalNet: number; deltaPercentage: number | null }>;
  };
  employees: Array<{
    employeeId: string; employeeCode: string; fullName: string;
    departmentName: string; positionTitle: string;
    baseSalary: number; fixedAllowance: number; overtimePay: number;
    bpjsKesehatan: number; bpjsJht: number; bpjsJp: number; pph21: number;
    gross: number; totalDeductions: number; net: number;
    overtimeHours: number;
  }>;
  employeesPagination: {
    page: number; pageSize: number; total: number;
  };
  bpjs: {
    totalRegistered: number; totalPending: number; totalMissing: number;
    byClass: Array<{ className: string; count: number }>;
    employees: Array<{
      employeeId: string; employeeCode: string; fullName: string;
      bpjsTkNumberMasked: string | null; bpjsKesNumberMasked: string | null;
      bpjsKesClass: string | null;
      bpjsTkStatus: string; bpjsKesStatus: string;
    }>;
  };
  overtime: {
    totalHours: number; totalPay: number;
    pendingApprovals: number;
    byDepartment: Array<{ departmentName: string; hours: number; pay: number }>;
  };
  operational: {
    totalAmount: number;
    byCategory: Array<{ category: string; count: number; amount: number }>;
    byStatus: Array<{ status: string; count: number; amount: number }>;
  };
  analysis: {
    costPerEmployee: number;
    topDecileCostShare: number;        // % total biaya yang dipegang 10% termahal
    payrollGrowthPercentage: number | null;
    highlights: string[];
  };
}
```

**Aturan & kepatuhan:**
- BPJS **hanya** nomor ter-masking. Implementasi memakai ulang `listSocialSecurityForHr()` yang mem-mask di service; BOD tidak diberi `social_security:reveal`.
- Data gaji per pegawai adalah RESTRICTED: hanya dikembalikan ke pemegang `payroll:read` (BOD/HR_MANAGER/AUDITOR/SUPER_ADMIN).
- Pembagian nol: run payroll kosong → `costPerEmployee = 0`; `topDecileCostShare = 0` bila total net 0.
- Trend `deltaPercentage` bernilai `null` pada titik pertama (tidak ada pembanding), bukan 0.
- Rincian pegawai dipaginasi (`page`, `pageSize` bawaan 50) dan dihitung di SQL, bukan di JavaScript.

---

## 7. Kapabilitas 5 — Semua Hasil Berbentuk Analisis

Setiap respons memiliki objek `analysis` berisi metrik turunan dan `highlights` (kalimat temuan yang dihitung dari data), sehingga tab tidak pernah hanya menampilkan angka mentah:

| Tab | Metrik turunan | Contoh highlight |
|---|---|---|
| Aktivitas | coverage pegawai aktif, peringkat departemen/tipe event | "3 dari 7 pegawai aktif tanpa aktivitas tercatat." |
| Visi-Misi | capaian tertimbang, jumlah pilar tercapai, pilar terlemah | "Pilar Pembelajaran tertinggal 16,7 poin dari target." |
| Posisi & RJMP | coverage template, jumlah posisi tanpa template | "2 posisi belum punya template KPI." |
| Biaya | biaya per pegawai, konsentrasi top-decil, pertumbuhan payroll | "10% pegawai termahal menyerap 34% total biaya." |

Narasi AI menjadi lapisan terakhir pada tab Visi-Misi; angka tetap menjadi sumber kebenaran dan tidak pernah digantikan narasi.

---

## 8. Keamanan & Kepatuhan

| Aspek | Implementasi |
|---|---|
| RBAC | `analytics:read` untuk aktivitas/visi/posisi; `payroll:read` untuk biaya; `ai:read` untuk AI |
| Data RESTRICTED | Gaji/BPJS tidak pernah masuk konteks AI (allowlist kunci); nomor BPJS ter-masking |
| Aktivitas | `visibility = 'RESTRICTED'` dikecualikan di SQL |
| Audit | Generasi AI dicatat sebagai `CREATE`/`UPDATE` pada `ai_insights` (sesuai CHECK constraint `audit_logs.action_type`) |
| Tanpa fallback | Tidak ada angka hardcoded; kegagalan API ditampilkan sebagai kegagalan |

**Keputusan eksplisit soal audit baca:** `audit_logs` berorientasi mutasi (memiliki CHECK constraint terbatas dan rantai hash anti-tamper). Membuka tab biaya **tidak** dicatat sebagai baris audit agar tidak mengubah skema dan tidak membanjiri log. Perlindungan data RESTRICTED pada tab ini bertumpu pada RBAC (`payroll:read`) dan masking nomor BPJS, sesuai PRD §6.2.4–6.2.5. Bila kelak kebijakan menuntut jejak baca, itu perubahan terpisah.

---

## 9. Rencana Pengujian

**Unit (TDD, tulis gagal dulu):**
1. `boardActivityAnalyticsService` — RESTRICTED tidak terhitung; `byOwnerRole` benar; data kosong menghasilkan 0 tanpa error; `coveragePercentage` tidak membagi nol saat tidak ada pegawai aktif.
2. `boardVisionAchievementService` — rata-rata tertimbang benar; pilar tanpa KPI → `NO_DATA` dan 0%; visi/misi kosong → `null`; `missions` terpecah benar.
3. `boardPositionFitService` — posisi tanpa template → `NO_TEMPLATE`; KPI tidak cocok → `matchedKpiCount` lebih kecil; ambang status 80/50 diuji di batas.
4. `boardCostService` — run kosong → `costPerEmployee = 0`; `deltaPercentage` pertama `null`; `topDecileCostShare` benar; nomor BPJS ter-mask.
5. `aiInsightCacheService` — cache hit tanpa `force`; `force` menulis ulang; `payload_hash` berubah saat data berubah; `audit_logs` menerima `action_type` yang diizinkan CHECK constraint (bukan nilai baru yang akan gagal insert).

**Integrasi route:**
- 401 tanpa sesi; 403 untuk `EMPLOYEE` pada keempat endpoint.
- BOD → 200 untuk semua.
- Respons `board-cost` **tidak** mengandung nomor BPJS 16 digit (regex `\d{16}`).
- `board-activity` tidak memuat event RESTRICTED.
- `POST /ai/board-analysis` tanpa kunci → 200 `configured:false`.

**UI:**
- Kelima tab berpindah dan memuat data masing-masing.
- API gagal → pesan gagal, bukan angka.
- Tombol AI tidak memanggil otomatis saat mount.
- Deep-link `?tab=vision` membuka tab yang benar.

**Regresi:** `tests/unit/middleware.test.ts`, suite Narasi 3 (`hr-command`), dan `tests/api/dashboard-routes.test.ts` tetap lulus.

---

## 10. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Data seed tipis → persentase ekstrem | Setiap respons menyertakan `sampleSize`; UI menampilkan jumlah sampel di samping persentase |
| Judul KPI diubah manual → kecocokan turun | Ditampilkan eksplisit sebagai "KPI tidak cocok", bukan ditebak |
| AI tidak terkonfigurasi | `configured:false` + pesan ramah; tab tetap berfungsi penuh |
| Payload biaya besar (semua pegawai) | Paginasi bawaan 50 baris + pencarian; agregat dihitung di SQL |
| Klasifikasi data bocor lewat AI | Allowlist kunci konteks + test yang memeriksa absennya kunci payroll |

---

## 11. Daftar File

**Baru — service**
- `src/lib/services/boardActivityAnalyticsService.ts`
- `src/lib/services/boardVisionAchievementService.ts`
- `src/lib/services/boardPositionFitService.ts`
- `src/lib/services/boardCostService.ts`
- `src/lib/services/aiInsightCacheService.ts`

**Baru — route**
- `src/app/api/v1/analytics/board-activity/route.ts`
- `src/app/api/v1/analytics/vision-achievement/route.ts`
- `src/app/api/v1/analytics/position-fit/route.ts`
- `src/app/api/v1/analytics/board-cost/route.ts`
- `src/app/api/v1/ai/board-analysis/route.ts`

**Baru — UI**
- `src/components/executive/BoardTabNav.tsx`
- `src/components/executive/BoardActivityPanel.tsx`
- `src/components/executive/BoardVisionPanel.tsx`
- `src/components/executive/BoardPositionFitPanel.tsx`
- `src/components/executive/BoardCostPanel.tsx`
- `src/components/executive/BoardAiInsight.tsx`

**Baru — migrasi**
- `src/lib/db/migrations/0057_ai_insights.sql`

**Diubah**
- `src/app/dashboard/executive/page.tsx` (5 tab; hapus fallback hardcoded)
- `src/lib/services/aiContext.ts` (perluas konteks `executive`)
- `src/lib/services/aiService.ts` (dukungan feature `board`)

**Test baru**
- `tests/unit/boardActivityAnalyticsService.test.ts`
- `tests/unit/boardVisionAchievementService.test.ts`
- `tests/unit/boardPositionFitService.test.ts`
- `tests/unit/boardCostService.test.ts`
- `tests/unit/aiInsightCacheService.test.ts`
- `tests/integration/board-api.test.ts`
- `tests/ui/board-executive.test.tsx`
