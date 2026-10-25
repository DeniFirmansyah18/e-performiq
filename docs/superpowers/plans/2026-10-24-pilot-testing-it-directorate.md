# Rencana Pengujian Percontohan (Pilot Testing) & Audit Keamanan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menjalankan pengujian percontohan (pilot testing) siklus penilaian menyeluruh pada 1 Direktorat (IT & Engineering) serta memvalidasi kepatuhan tata kelola (GCG) dan audit keamanan sesuai standar PRD §9 Fase 4/6.

**Architecture:** Pengujian integrasi skenario penuh (*end-to-end integration test*) menggunakan PGlite in-memory murni, mensimulasikan siklus karyawan IT dari input KPI harian, verifikasi atasan, penghitungan snapshot DPI & rekap, kalkulasi GPA/VMAI, hingga audit trail berantai (hash chain) dan perlindungan data sensitif (masking BPJS/Gaji).

**Tech Stack:** Vitest, PGlite, Drizzle ORM, TypeScript.

**Spec:** `PRD_Sistem_Penilaian_Karyawan (PT).md` §8 & §9.

## Global Constraints

- Menggunakan runner Vitest yang sudah ada (`npx vitest run <file>`).
- Setiap transaksi pengujian tidak boleh merusak direktori basis data lokal `.pglite`.
- Data berlabel `RESTRICTED` (nomor BPJS lengkap, gaji) tidak boleh bocor pada konteks publik maupun AI Coach.
- Audit trail menerapkan skema *append-only* dengan verifikasi integritas rantai hash SHA-256.

## Review Focus

- **Verifikasi Ganda:** Dua atasan memverifikasi entri harian yang sama secara bersamaan (harus gagal dengan error bisnis).
- **Integritas Rantai Hash:** Modifikasi ilegal pada tabel `audit_logs` terdeteksi sebagai anomali integritas.
- **Kerahasiaan Data Sensitif:** Akses nomor BPJS tanpa peran/hak akses yang sah harus dibatasi dan ter-masking.
- **Kalkulasi Nilai Ekstrem:** Nilai aktual nol pada KPI dengan arah `LOWER_BETTER` tidak menghasilkan pembagian dengan nol.
- **Batasan AI Context:** Konteks performa yang dikirim ke AI Coach tidak memuat atribut gaji atau data medis.

---

### Task 1: End-to-End Pilot Simulation Test (Direktorat IT & Engineering)

**Files:**
- Create: `tests/integration/pilot-it-directorate-e2e.test.ts`

**Interfaces:**
- Consumes:
  - `submitDailyEntry(db, input)` dari `@/lib/services/dailyKpiService`
  - `verifyEntry(db, input)` dari `@/lib/services/dailyKpiService`
  - `storeSnapshot(db, employeeId, date)` dari `@/lib/services/dailyPerformanceService`
  - `getPerformanceRecap(db, employeeId, period)` dari `@/lib/services/dailyPerformanceService`
  - `verifyAuditChain(db)` dari `@/lib/services/auditService`
- Produces:
  - Skenario pengujian lengkap yang memvalidasi siklus penuh 1 direktorat percontohan.

- [ ] **Step 1: Write the pilot simulation test**

Buat berkas `tests/integration/pilot-it-directorate-e2e.test.ts` dengan skenario:
1. Inisialisasi basis data pengujian PGlite dengan migrasi penuh.
2. Buat entri KPI harian untuk karyawan percontohan (Budi Pratama).
3. Jalankan persetujuan atasan (Raden Mas Danu).
4. Hitung snapshot DPI harian dan rekap bulanan.
5. Verifikasi bahwa audit log mencatat seluruh tindakan dengan rantai hash utuh.

- [ ] **Step 2: Run test to verify it executes and passes**

Jalankan: `npx vitest run tests/integration/pilot-it-directorate-e2e.test.ts`
Ekspektasi: Seluruh pengujian dalam skenario percontohan lulus (PASS).

- [ ] **Step 3: Commit**

```bash
git add tests/integration/pilot-it-directorate-e2e.test.ts
git commit -m "test(pilot): simulasi siklus penilaian penuh direktorat TI & audit integritas"
```
